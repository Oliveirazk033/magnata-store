'use client'

import { useState } from 'react'
import { AlertTriangle, Copy, Check, ArrowLeft, Loader2, Clock, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  availableKeys: number
}

export interface Order {
  id: string
  amount: number
  status: string
  pixCode: string | null
  payerName: string
  productName: string
  createdAt: string
}

interface CheckoutProps {
  product: Product
  onBack: () => void
  onOrderCreated: (order: Order) => void
}

function formatPrice(price: number): string {
  return `R$ ${(price / 100).toFixed(2).replace('.', ',')}`
}

export function Checkout({ product, onBack, onOrderCreated }: CheckoutProps) {
  const [payerName, setPayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payerName.trim()) {
      toast.error('Digite seu nome completo')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, payerName: payerName.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar pedido')
        return
      }

      setOrder(data.order)
      onOrderCreated(data.order)
      toast.success('Pedido criado com sucesso!')
    } catch {
      toast.error('Erro de conexao. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  if (order) {
    return (
      <div className="max-w-lg mx-auto fade-in">
        <Card className="card-glow bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Pedido #{order.id.slice(-6)}</CardTitle>
                <p className="text-sm text-muted-foreground">{order.productName}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant="secondary"
                className={
                  order.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }
              >
                {order.status === 'pending' ? (
                  <><Clock className="mr-1 h-3 w-3" /> Aguardando pagamento</>
                ) : (
                  'Aprovado'
                )}
              </Badge>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor exato do PIX</span>
              <span className="text-xl font-bold text-primary">{formatPrice(order.amount)}</span>
            </div>

            {/* PIX Key */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Chave PIX</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary/80 rounded-lg px-4 py-3 text-sm font-mono text-foreground truncate">
                  {order.pixCode || 'Nao configurada'}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(order.pixCode || '')}
                  className="shrink-0 hover:bg-primary/20 hover:text-primary hover:border-primary/30"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Copy Amount Button */}
            <Button
              variant="outline"
              className="w-full hover:bg-primary/20 hover:text-primary hover:border-primary/30"
              onClick={() => copyToClipboard(formatPrice(order.amount))}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar valor exato: {formatPrice(order.amount)}
            </Button>

            {/* Warning */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Envie exatamente <strong>{formatPrice(order.amount)}</strong> via PIX.
                  O nome do titular do pagamento deve ser <strong>{order.payerName}</strong>.
                  Pedidos com valor ou nome divergentes nao serao aprovados automaticamente.
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar a loja
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto fade-in">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar a loja
      </Button>

      <Card className="card-glow bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Finalizar Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Product Summary */}
          <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg mb-5">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-6 w-6 text-primary/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-5">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                O nome que voce digitar abaixo deve ser <strong>exatamente o nome do titular</strong> da conta
                que fara o PIX. Pedidos com nomes divergentes nao serao aprovados automaticamente.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payerName">Nome completo do titular do PIX</Label>
              <Input
                id="payerName"
                placeholder="Ex: Joao Silva Santos"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                required
                className="bg-secondary/50 border-border focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !payerName.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando pedido...
                </>
              ) : (
                'Gerar Pedido'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}