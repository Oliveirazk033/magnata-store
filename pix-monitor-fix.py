"""
╔══════════════════════════════════════════════════════════════╗
║          Nubank PIX Monitor — SaaS Edition v1.0             ║
║  Monitora Gmail via IMAP, detecta PIX do Nubank             ║
║  e envia notificações para Discord via Webhook               ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from email.header import decode_header
from email.utils import parsedate_to_datetime

import httpx
from dotenv import load_dotenv
from imapclient import IMAPClient
from mailparser import parse_from_bytes
from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

# ──────────────────────────────────────────────────────────────
#  Configuração inicial
# ──────────────────────────────────────────────────────────────
load_dotenv()

console = Console()
log = console.log

# Configuração do logging com Rich
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(console=console, rich_tracebacks=True)],
)
logger = logging.getLogger("pix-monitor")

# ──────────────────────────────────────────────────────────────
#  Variáveis de ambiente
# ──────────────────────────────────────────────────────────────
GMAIL_EMAIL: str = os.getenv("GMAIL_EMAIL", "")
GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", "")
DISCORD_WEBHOOK_URL: str = os.getenv("DISCORD_WEBHOOK_URL", "")
CHECK_INTERVAL: int = int(os.getenv("CHECK_INTERVAL", "30"))
DB_PATH: str = os.getenv("DB_PATH", "processed_emails.db")
BOT_NAME: str = os.getenv("BOT_NAME", "Nubank PIX Monitor")
BOT_AVATAR_URL: str = os.getenv("BOT_AVATAR_URL", "")

# ── Integração com o site (auto-aprovação) ──
SITE_WEBHOOK_URL: str = os.getenv("SITE_WEBHOOK_URL", "")
SITE_WEBHOOK_SECRET: str = os.getenv("SITE_WEBHOOK_SECRET", "")


# ──────────────────────────────────────────────────────────────
#  Validação de configuração
# ──────────────────────────────────────────────────────────────
def validate_config() -> None:
    """Valida se todas as variáveis obrigatórias estão preenchidas."""
    erros: list[str] = []

    if not GMAIL_EMAIL or GMAIL_EMAIL == "seu_email_aqui@gmail.com":
        erros.append("  [!] GMAIL_EMAIL não configurado no .env")
    if not GMAIL_APP_PASSWORD or GMAIL_APP_PASSWORD == "sua_senha_de_app_aqui":
        erros.append("  [!] GMAIL_APP_PASSWORD não configurado no .env")
    if not DISCORD_WEBHOOK_URL or "SEU_WEBHOOK_AQUI" in DISCORD_WEBHOOK_URL:
        erros.append("  [!] DISCORD_WEBHOOK_URL não configurado no .env")
    if not SITE_WEBHOOK_URL or "SEU_SITE_AQUI" in SITE_WEBHOOK_URL:
        erros.append("  [!] SITE_WEBHOOK_URL não configurado no .env")
    if not SITE_WEBHOOK_SECRET or "SEU_SECRET_AQUI" in SITE_WEBHOOK_SECRET:
        erros.append("  [!] SITE_WEBHOOK_SECRET não configurado no .env")

    if erros:
        console.print("\n[bold red]✘ ERRO DE CONFIGURAÇÃO — Preencha o arquivo .env:[/bold red]\n")
        for e in erros:
            console.print(f"  [red]{e}[/red]")
        console.print(
            '\n  Copie [cyan].env.example[/cyan] para [cyan].env[/cyan] e preencha os valores.\n'
        )
        sys.exit(1)


validate_config()


# ──────────────────────────────────────────────────────────────
#  Banco de dados SQLite — Prevenção de duplicatas
# ──────────────────────────────────────────────────────────────
class EmailDatabase:
    """Gerencia o banco SQLite para rastrear e-mails já processados."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        """Cria a tabela se não existir."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS processed_emails (
                    message_id   TEXT PRIMARY KEY,
                    subject      TEXT,
                    amount       REAL,
                    sender       TEXT,
                    description  TEXT,
                    processed_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_processed_at
                ON processed_emails(processed_at)
            """)
            conn.commit()
        logger.info(f"Banco SQLite inicializado: [cyan]{self.db_path}[/cyan]")

    def is_processed(self, message_id: str) -> bool:
        """Verifica se um e-mail já foi processado."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT 1 FROM processed_emails WHERE message_id = ?",
                (message_id,),
            ).fetchone()
            return row is not None

    def mark_processed(
        self,
        message_id: str,
        subject: str,
        amount: float,
        sender: str,
        description: str,
    ) -> None:
        """Marca um e-mail como processado."""
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT OR IGNORE INTO processed_emails
                   (message_id, subject, amount, sender, description, processed_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (message_id, subject, amount, sender, description, now),
            )
            conn.commit()

    def get_stats(self) -> dict:
        """Retorna estatísticas do banco."""
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM processed_emails").fetchone()[0]
            total_amount = conn.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM processed_emails"
            ).fetchone()[0]
        return {"total": total, "total_amount": total_amount}


db = EmailDatabase(DB_PATH)


# ──────────────────────────────────────────────────────────────
#  Parser de e-mails do Nubank
# ──────────────────────────────────────────────────────────────
def extract_text_from_email(raw_email: bytes) -> str:
    """Extrai todo o texto visível do e-mail (HTML + texto puro)."""
    try:
        mail = parse_from_bytes(raw_email)
        parts: list[str] = []

        # Texto puro
        if mail.text_plain:
            for part in mail.text_plain:
                parts.append(part)

        # Texto do HTML (strip tags)
        if mail.text_html:
            for html_part in mail.text_html:
                text = re.sub(r"<[^>]+>", " ", html_part)
                text = re.sub(r"\s+", " ", text).strip()
                parts.append(text)

        return " ".join(parts)
    except Exception as e:
        logger.warning(f"Falha ao parsear e-mail: {e}")
        return ""


def decode_subject(subject_raw: str | None) -> str:
    """Decodifica o assunto do e-mail."""
    if not subject_raw:
        return ""
    try:
        parts = decode_header(subject_raw)
        decoded = []
        for data, charset in parts:
            if isinstance(data, bytes):
                decoded.append(data.decode(charset or "utf-8", errors="replace"))
            else:
                decoded.append(data)
        return " ".join(decoded)
    except Exception:
        return subject_raw


def is_nubank_pix_email(subject: str, from_addr: str) -> bool:
    """Verifica se o e-mail é uma notificação de PIX do Nubank."""
    subject_lower = subject.lower()
    from_lower = from_addr.lower()

    # Padrões conhecidos do Nubank para PIX
    nubank_patterns = [
        "nubank" in from_lower,
        "contato@nubank.com.br" in from_lower,
        "pix recebido" in subject_lower,
        "voce recebeu um pix" in subject_lower,
        "recebemos um pix" in subject_lower,
        "pix" in subject_lower and "receb" in subject_lower,
    ]

    return any(nubank_patterns)


def extract_pix_data(email_text: str) -> dict | None:
    """
    Extrai dados do PIX a partir do corpo do e-mail.
    Retorna dict com amount, sender, description ou None.
    """
    if not email_text:
        return None

    data: dict = {"amount": 0.0, "sender": "Desconhecido", "description": ""}

    # ── Valor do PIX ──
    # Padrões comuns: R$ 100,00 / R$100,00 / R$ 1.234,56 / R$50,00
    amount_patterns = [
        r"R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})",  # R$ 1.234,56
        r"R\$\s*(\d+,\d{2})",                    # R$ 50,00
        r"valor[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})",
        r"recebeu\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})",
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            valor_str = match.group(1).replace(".", "").replace(",", ".")
            try:
                data["amount"] = float(valor_str)
                break
            except ValueError:
                continue

    # ── Nome de quem enviou ──
    sender_patterns = [
        r"de\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)",
        r"enviada\s+por\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)",
        r"quem\s+enviou[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)",
        r"recebido\s+de\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)",
        r"remetente[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)",
    ]

    for pattern in sender_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Filtra nomes que são claramente parte do layout
            stop_words = {"nubank", "pix", "valor", "recebido", "enviado", "conta"}
            words = name.split()
            if not any(w.lower() in stop_words for w in words) and len(words) >= 2:
                data["sender"] = name
                break

    # ── Descrição / ID da transação ──
    desc_patterns = [
        r"descri(?:ç|c)(?:ã|a)o[:\s]+(.{2,80}?)(?:\n|$)",
        r"identificad(?:o|or)[:\s]+([A-Za-z0-9_-]{5,50})",
        r"ref[:\s]+([A-Za-z0-9_.-]{5,50})",
        r"mensagem[:\s]+(.{2,80}?)(?:\n|$)",
    ]

    for pattern in desc_patterns:
        match = re.search(pattern, email_text, re.IGNORECASE)
        if match:
            desc = match.group(1).strip()
            if len(desc) >= 2:
                data["description"] = desc
                break

    # Só retorna se encontrou pelo menos o valor
    if data["amount"] > 0:
        return data
    return None


# ──────────────────────────────────────────────────────────────
#  Notificação Discord via Webhook
# ──────────────────────────────────────────────────────────────
def send_discord_notification(pix_data: dict, subject: str) -> bool:
    """
    Envia notificação para o Discord via Webhook com embed profissional.
    Retorna True se enviado com sucesso.
    """
    amount_str = f"R$ {pix_data['amount']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    sender = pix_data.get("sender", "Desconhecido")
    description = pix_data.get("description", "Sem descrição")
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    embed = {
        "title": "💰 PIX Recebido!",
        "description": f"**{subject}**",
        "color": 0x8A05BE,  # Roxo Nubank
        "fields": [
            {
                "name": "💵 Valor",
                "value": f"```{amount_str}```",
                "inline": True,
            },
            {
                "name": "👤 Quem enviou",
                "value": f"**{sender}**",
                "inline": True,
            },
            {
                "name": "📝 Descrição",
                "value": description if description else "—",
                "inline": False,
            },
            {
                "name": "🕐 Detectado em",
                "value": now,
                "inline": True,
            },
        ],
        "footer": {
            "text": f"{BOT_NAME} • Auto-detectado via IMAP",
            "icon_url": "https://logodownload.org/wp-content/uploads/2021/03/nubank-logo-3.png",
        },
        "thumbnail": {
            "url": "https://logodownload.org/wp-content/uploads/2021/03/nubank-logo-3.png"
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    payload: dict = {
        "username": BOT_NAME,
        "embeds": [embed],
    }
    if BOT_AVATAR_URL:
        payload["avatar_url"] = BOT_AVATAR_URL

    try:
        response = httpx.post(
            DISCORD_WEBHOOK_URL,
            json=payload,
            timeout=15.0,
        )
        if response.status_code == 204:
            logger.info("[bold green]✓ Notificação enviada para o Discord[/bold green]")
            return True
        else:
            logger.error(
                f"[red]✘ Discord retornou status {response.status_code}: "
                f"{response.text[:200]}[/red]"
            )
            return False
    except httpx.TimeoutException:
        logger.error("[red]✘ Timeout ao enviar para o Discord[/red]")
        return False
    except Exception as e:
        logger.error(f"[red]✘ Erro ao enviar para o Discord: {e}[/red]")
        return False


# ──────────────────────────────────────────────────────────────
#  Integração com o site — Auto-aprovação de pedidos
# ──────────────────────────────────────────────────────────────
def approve_order_on_site(pix_data: dict, message_id: str) -> dict | None:
    """
    Envia os dados do PIX para o site aprovar o pedido automaticamente.
    Retorna a resposta da API ou None em caso de erro.
    """
    if not SITE_WEBHOOK_URL or not SITE_WEBHOOK_SECRET:
        logger.warning("[yellow]⚠ Site webhook não configurado, pulando auto-aprovação[/yellow]")
        return None

    try:
        response = httpx.post(
            SITE_WEBHOOK_URL,
            json={
                "amount": pix_data["amount"],
                "sender": pix_data["sender"],
                "description": pix_data["description"],
                "messageId": message_id,
            },
            headers={
                "x-webhook-secret": SITE_WEBHOOK_SECRET,
                "Content-Type": "application/json",
            },
            timeout=20.0,
        )

        data = response.json()

        if response.status_code == 200 and data.get("success"):
            logger.info(
                f"[bold green]✅ Pedido {data.get('orderId', '?')[:8]}... auto-aprovado! "
                f"{data.get('credits', '?')} creditos para {data.get('buyerName', '?')}[/bold green]"
            )
            return data
        elif response.status_code == 404:
            logger.warning(
                f"[yellow]⚠ Nenhum pedido pendente para R$ {pix_data['amount']:.2f} "
                f"— {data.get('message', 'sem correspondência')}[/yellow]"
            )
            return data
        else:
            logger.error(
                f"[red]✘ Site retornou status {response.status_code}: "
                f"{data.get('error', response.text[:150])}[/red]"
            )
            return data

    except httpx.TimeoutException:
        logger.error("[red]✘ Timeout ao contactar o site[/red]")
        return None
    except Exception as e:
        logger.error(f"[red]✘ Erro ao contactar o site: {e}[/red]")
        return None


# ──────────────────────────────────────────────────────────────
#  Callback — chamado quando um PIX é detectado
# ──────────────────────────────────────────────────────────────
def on_pix_received(pix_data: dict, subject: str, message_id: str) -> None:
    """
    Callback chamado automaticamente quando um PIX é detectado.
    1. Loga no terminal com tabela Rich
    2. Envia notificação para o Discord
    3. Auto-aprova o pedido no site

    Args:
        pix_data: Dicionário com 'amount', 'sender', 'description'
        subject: Assunto do e-mail
        message_id: ID único do e-mail no Gmail
    """
    # ── 1. Log formatado no terminal ──
    amount_str = f"R$ {pix_data['amount']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    table = Table(
        title="🔔 NOVO PIX DETECTADO",
        border_style="bold magenta",
        title_style="bold magenta",
        show_header=False,
        padding=(0, 2),
    )
    table.add_column("Campo", style="bold cyan", width=16)
    table.add_column("Valor", style="bold white")
    table.add_row("Valor", f"[bold green]{amount_str}[/bold green]")
    table.add_row("Remetente", f"[yellow]{pix_data['sender']}[/yellow]")
    table.add_row("Descrição", pix_data["description"] or "[dim]—[/dim]")
    table.add_row("Assunto", subject[:80])
    table.add_row("Message ID", f"[dim]{message_id[:50]}...[/dim]")
    console.print(table)
    console.print()

    # ── 2. Envia notificação para o Discord ──
    send_discord_notification(pix_data, subject)

    # ── 3. Auto-aprova pedido no site ──
    site_result = approve_order_on_site(pix_data, message_id)
    if site_result and site_result.get("success"):
        # Envia segundo embed no Discord confirmando a aprovação
        send_discord_approval_confirmation(site_result, pix_data)


def send_discord_approval_confirmation(site_result: dict, pix_data: dict) -> bool:
    """Envia embed de confirmação de aprovação automática no Discord."""
    amount_str = f"R$ {pix_data['amount']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    embed = {
        "title": "✅ Créditos Aprovados Automaticamente!",
        "description": f"O pedido foi encontrado e os créditos já foram adicionados.",
        "color": 0x57F287,  # Verde
        "fields": [
            {"name": "👤 Cliente", "value": f"**{site_result.get('buyerName', '?')}**", "inline": True},
            {"name": "💰 Valor", "value": f"```{amount_str}```", "inline": True},
            {"name": "🪙 Créditos", "value": f"**+{site_result.get('credits', '?')} creditos**", "inline": True},
            {"name": "📋 Pedido", "value": f"`{site_result.get('orderId', '?')[:12]}...`", "inline": True},
        ],
        "footer": {"text": f"{BOT_NAME} • Auto-aprovação via PIX"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    payload: dict = {"username": BOT_NAME, "embeds": [embed]}
    if BOT_AVATAR_URL:
        payload["avatar_url"] = BOT_AVATAR_URL

    try:
        response = httpx.post(DISCORD_WEBHOOK_URL, json=payload, timeout=15.0)
        return response.status_code == 204
    except Exception:
        return False


# ──────────────────────────────────────────────────────────────
#  Monitor IMAP — Conexão e busca de e-mails
# ──────────────────────────────────────────────────────────────
class IMAPMonitor:
    """Monitor de IMAP com auto-reconexão e tratamento de erros."""

    def __init__(self) -> None:
        self.client: IMAPClient | None = None
        self._retry_count = 0
        self._max_retries = 10
        self._base_delay = 5  # segundos

    def connect(self) -> bool:
        """Conecta ao Gmail via IMAP com SSL."""
        try:
            self.client = IMAPClient(
                "imap.gmail.com",
                ssl=True,
                timeout=30,
            )
            self.client.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            self.client.select_folder("INBOX")
            self._retry_count = 0
            logger.info("[bold green]✓ Conectado ao Gmail IMAP com sucesso[/bold green]")
            return True
        except IMAPClient.Error as e:
            logger.error(f"[red]✘ Erro de autenticação IMAP: {e}[/red]")
            logger.error(
                "[yellow]  → Verifique se a Senha de App está correta[/yellow]"
            )
            logger.error(
                "[yellow]  → Ative 2FA no Google e crie uma Senha de App em:[/yellow]"
            )
            logger.error(
                "[yellow]  → https://myaccount.google.com/apppasswords[/yellow]"
            )
            return False
        except Exception as e:
            logger.error(f"[red]✘ Erro ao conectar IMAP: {e}[/red]")
            return False

    def disconnect(self) -> None:
        """Desconecta do IMAP com segurança."""
        try:
            if self.client:
                self.client.logout()
                logger.info("Desconectado do IMAP")
        except Exception:
            pass
        finally:
            self.client = None

    def _backoff_delay(self) -> float:
        """Calcula delay exponencial para retry com jitter."""
        delay = min(self._base_delay * (2 ** self._retry_count), 300)
        jitter = delay * 0.1 * (hash(str(time.time())) % 10)
        return delay + jitter

    def check_new_emails(self) -> int:
        """
        Busca e-mails não lidos do Nubank sobre PIX.
        Retorna quantos novos PIXs foram processados.
        """
        if not self.client:
            return 0

        try:
            # Busca e-mails NÃO LIDOS do Nubank sobre PIX
            self.client.select_folder("INBOX")
            messages = self.client.search(
                ["FROM", "nubank", "SUBJECT", "PIX", "UNSEEN"]
            )

            if not messages:
                return 0

            pix_count = 0
            logger.info(
                f"[cyan]📧 Encontrados {len(messages)} e-mail(s) não lido(s) "
                f"do Nubank sobre PIX[/cyan]"
            )

            for msg_id in messages:
                try:
                    response = self.client.fetch([msg_id], ["BODY.PEEK[]", "ENVELOPE"])
                    if msg_id not in response:
                        continue

                    msg_data = response[msg_id]
                    raw_email = msg_data[b"BODY[]"]
                    envelope = msg_data[b"ENVELOPE"]

                    # Extrai message ID
                    message_id_str = envelope.message_id.decode() if envelope.message_id else f"manual-{msg_id}"

                    # Decodifica assunto
                    subject = decode_subject(
                        envelope.subject.decode() if envelope.subject else ""
                    )

                    # Extrai remetente
                    from_addr = ""
                    if envelope.from_:
                        addr = envelope.from_[0]
                        # imapclient 3.x: Address object com .mailbox e .host
                        if hasattr(addr, 'mailbox') and hasattr(addr, 'host'):
                            from_addr = f"{addr.mailbox}@{addr.host}" if addr.mailbox else ""
                        else:
                            # imapclient 2.x: tuple (name, email_bytes)
                            from_name, from_email = addr
                            from_addr = from_email.decode() if from_email else ""

                    # Verifica duplicata
                    if db.is_processed(message_id_str):
                        logger.debug(f"[dim]  ↳ Duplicata ignorada: {message_id_str[:40]}...[/dim]")
                        continue

                    # Verifica se é e-mail de PIX do Nubank
                    if not is_nubank_pix_email(subject, from_addr):
                        logger.debug(f"[dim]  ↳ Não é PIX do Nubank: {subject[:50]}[/dim]")
                        continue

                    # Extrai texto do e-mail
                    email_text = extract_text_from_email(raw_email)

                    # Extrai dados do PIX
                    pix_data = extract_pix_data(email_text)
                    if pix_data is None:
                        logger.warning(
                            f"[yellow]  ⚠ E-mail de PIX mas não conseguiu "
                            f"extrair valor: {subject[:60]}[/yellow]"
                        )
                        # Marca como processado mesmo assim para não reprocessar
                        db.mark_processed(message_id_str, subject, 0, "N/A", "Parse falhou")
                        continue

                    # Marca como processado
                    db.mark_processed(
                        message_id_str,
                        subject,
                        pix_data["amount"],
                        pix_data["sender"],
                        pix_data["description"],
                    )

                    # Marca e-mail como lido no Gmail para não reprocessar
                    try:
                        self.client.add_flags([msg_id], [b'\\Seen'])
                    except Exception:
                        pass

                    # Chama callback
                    on_pix_received(pix_data, subject, message_id_str)
                    pix_count += 1

                except Exception as e:
                    logger.error(f"[red]  ✘ Erro ao processar e-mail {msg_id}: {e}[/red]")
                    continue

            return pix_count

        except IMAPClient.Error as e:
            logger.error(f"[red]✘ Erro IMAP durante busca: {e}[/red]")
            self.disconnect()
            return -1  # Sinaliza que precisa reconectar
        except Exception as e:
            logger.error(f"[red]✘ Erro inesperado durante busca: {e}[/red]")
            return -1

    def run(self) -> None:
        """Loop principal de monitoramento com auto-reconexão."""
        console.print(
            Panel(
                Text(
                    f"  🏦 Nubank PIX Monitor v1.0\n"
                    f"  📧 Conta: [cyan]{GMAIL_EMAIL}[/cyan]\n"
                    f"  ⏱  Intervalo: [yellow]{CHECK_INTERVAL}s[/yellow]\n"
                    f"  🗄  SQLite: [green]{DB_PATH}[/green]",
                    style="white",
                ),
                title="[bold magenta]Nubank PIX Monitor[/bold magenta]",
                border_style="bold magenta",
                padding=(1, 2),
            )
        )
        console.print()

        while True:
            # Conecta se necessário
            if not self.client:
                if not self.connect():
                    delay = self._backoff_delay()
                    self._retry_count += 1
                    logger.warning(
                        f"[yellow]⏳ Tentando reconectar em {delay:.0f}s "
                        f"(tentativa {self._retry_count}/{self._max_retries})...[/yellow]"
                    )
                    time.sleep(delay)
                    if self._retry_count >= self._max_retries:
                        logger.error(
                            "[bold red]✘ Máximo de tentativas atingido. "
                            "Aguardando 5 minutos antes de recomeçar...[/bold red]"
                        )
                        self._retry_count = 0
                        time.sleep(300)
                    continue

            # Verifica novos e-mails
            result = self.check_new_emails()

            if result == -1:
                # Precisa reconectar
                delay = self._backoff_delay()
                self._retry_count += 1
                logger.warning(
                    f"[yellow]⏳ Reconectando em {delay:.0f}s...[/yellow]"
                )
                time.sleep(delay)
                continue

            if result > 0:
                stats = db.get_stats()
                logger.info(
                    f"[bold green]📊 Total processado: {stats['total']} PIXs | "
                    f"Total recebido: R$ {stats['total_amount']:,.2f}[/bold green]"
                )

            # Aguarda próximo ciclo
            time.sleep(CHECK_INTERVAL)


# ──────────────────────────────────────────────────────────────
#  Ponto de entrada
# ──────────────────────────────────────────────────────────────
def run_once() -> int:
    """Conecta, checa uma vez e desconecta. Retorna quantidade de PIXs encontrados."""
    logger.info("[cyan]🔍 Iniciando verificação única...[/cyan]")
    monitor = IMAPMonitor()
    if not monitor.connect():
        return 0
    try:
        result = monitor.check_new_emails()
        if result == -1:
            logger.warning("[yellow]⚠ Erro na checagem, tentando reconectar...[/yellow]")
            if monitor.connect():
                result = monitor.check_new_emails()
        count = max(result, 0)
        if count == 0:
            logger.info("[dim]  Nenhum novo PIX encontrado.[/dim]")
        return count
    finally:
        monitor.disconnect()


def main() -> None:
    """Inicia o monitor de PIX."""
    once_mode = "--once" in sys.argv

    console.print()
    console.print(
        "[bold magenta]╔══════════════════════════════════════════════════════════════╗[/bold magenta]"
    )
    console.print(
        "[bold magenta]║          Nubank PIX Monitor — SaaS Edition v1.0             ║[/bold magenta]"
    )
    console.print(
        "[bold magenta]║  Monitora Gmail via IMAP, detecta PIX do Nubank             ║[/bold magenta]"
    )
    console.print(
        "[bold magenta]║  e envia notificações para Discord via Webhook               ║[/bold magenta]"
    )
    console.print(
        "[bold magenta]╚══════════════════════════════════════════════════════════════╝[/bold magenta]"
    )
    console.print()

    # Modo --once: checa uma vez e sai (usado pelo GitHub Actions)
    if once_mode:
        logger.info("[bold cyan]⚡ Modo --once: verificação única (GitHub Actions)[/bold cyan]")
        count = run_once()
        logger.info(f"[bold green]✓ Verificação concluída — {count} PIX(s) processado(s)[/bold green]")
        return

    # Tratamento de encerramento gracioso (Ctrl+C)
    try:
        monitor = IMAPMonitor()
        monitor.run()
    except KeyboardInterrupt:
        console.print("\n[bold yellow]⏹ Monitor encerrado pelo usuário (Ctrl+C)[/bold yellow]")
        monitor.disconnect()
        stats = db.get_stats()
        logger.info(
            f"[cyan]📊 Sessão finalizada — {stats['total']} PIXs processados, "
            f"R$ {stats['total_amount']:,.2f} detectados no total[/cyan]"
        )
    except Exception as e:
        logger.error(f"[bold red]✘ Erro fatal: {e}[/bold red]")
        raise


if __name__ == "__main__":
    main()