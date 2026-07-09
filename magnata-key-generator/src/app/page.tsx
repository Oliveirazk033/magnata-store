'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Starfield from '@/components/Starfield';
import {
  Key, Shield, Plus, Trash2, RefreshCw, Coins, ArrowRight,
  Lock, Unlock, History, Copy, Check, Store, BarChart3,
  Package, BookOpen, X, LayoutDashboard, Hash,
} from 'lucide-react';

/* ===== Types ===== */
interface Product {
  id: string; name: string; description: string | null;
  duration: string; credits: number; isActive: boolean;
  _count: { keys: number };
}
interface TransactionItem {
  id: string; key: { code: string }; productName: string;
  credits: number; buyerInfo: string; createdAt: string;
}
interface KeyItem {
  id: string; code: string; productId: string;
  product: { name: string; duration: string };
  isSold: boolean; soldTo: string | null; soldAt: string | null; createdAt: string;
}

/* ===== Main ===== */
export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [stats, setStats] = useState({ totalCredits: 0, totalSales: 0 });
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [buyerInfo, setBuyerInfo] = useState('');
  const [deliveredKey, setDeliveredKey] = useState<string | null>(null);
  const [deliveredProduct, setDeliveredProduct] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', description: '', duration: '', credits: '' });
  const [newKeysText, setNewKeysText] = useState('');
  const [addingKeysTo, setAddingKeysTo] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [adminTab, setAdminTab] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getAdminHeaders = () => ({ 'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '' });

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch { toast.error('Erro ao carregar produtos'); }
    finally { setLoadingProducts(false); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions', { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.transactions) { setTransactions(data.transactions); setStats({ totalCredits: data.totalCredits, totalSales: data.totalSales }); }
    } catch { /* silent */ }
  }, []);

  const fetchKeys = useCallback(async (productId?: string) => {
    try {
      const url = productId ? `/api/keys?productId=${productId}` : '/api/keys';
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (isAdmin) { fetchTransactions(); fetchKeys(); } }, [isAdmin, fetchTransactions, fetchKeys]);

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword }) });
      const data = await res.json();
      if (data.success) { setIsAdmin(true); setShowLoginModal(false); toast.success('Login realizado'); }
      else toast.error('Senha incorreta');
    } catch { toast.error('Erro ao fazer login'); }
    finally { setLoggingIn(false); }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.duration || !newProduct.credits) { toast.error('Preencha todos os campos'); return; }
    try {
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() }, body: JSON.stringify(newProduct) });
      const data = await res.json();
      if (data.product) { toast.success(`"${data.product.name}" criado!`); setNewProduct({ name: '', description: '', duration: '', credits: '' }); fetchProducts(); }
      else toast.error(data.error || 'Erro ao criar');
    } catch { toast.error('Erro'); }
  };

  const handleAddKeys = async () => {
    if (!addingKeysTo || !newKeysText.trim()) { toast.error('Selecione produto e cole as keys'); return; }
    const codes = newKeysText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() }, body: JSON.stringify({ productId: addingKeysTo, codes }) });
      const data = await res.json();
      if (data.added > 0) { toast.success(data.message); setNewKeysText(''); fetchProducts(); fetchKeys(addingKeysTo); }
      else toast.error(data.error || 'Nenhuma key adicionada');
    } catch { toast.error('Erro'); }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Desativar "${name}"?`)) return;
    try {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      toast.success('Produto desativado'); fetchProducts();
    } catch { toast.error('Erro'); }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('Key removida'); fetchKeys(selectedProductId || undefined); fetchProducts(); }
      else toast.error(data.error || 'Erro');
    } catch { toast.error('Erro'); }
  };

  const handleBuy = async (productId: string) => {
    if (!buyerInfo.trim()) { toast.error('Informe seu nome ou email'); return; }
    setBuyingProductId(productId); setDeliveredKey(null);
    try {
      const res = await fetch('/api/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, buyerInfo: buyerInfo.trim() }) });
      const data = await res.json();
      if (data.success) { setDeliveredKey(data.key); setDeliveredProduct(data.product); toast.success('Key gerada!'); fetchProducts(); }
      else toast.error(data.error || 'Erro na compra');
    } catch { toast.error('Erro'); }
    finally { setBuyingProductId(null); }
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); };
  const activeProducts = products.filter((p) => p.isActive);

  const navItems = isAdmin
    ? [
        { group: 'Principal', items: [{ icon: LayoutDashboard, label: 'Dashboard', tab: 'products' }] },
        { group: 'Estoque', items: [{ icon: Key, label: 'Produtos & Keys', tab: 'products' }, { icon: Package, label: 'Estoque', tab: 'stock' }, { icon: History, label: 'Histórico', tab: 'sales' }] },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white relative">
      <Starfield />

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.nav
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[260px] z-50 flex flex-col p-4"
              style={{
                background: 'linear-gradient(180deg, rgba(8,8,8,0.78), rgba(4,4,4,0.72))',
                backdropFilter: 'blur(36px) saturate(180%)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Key className="w-4 h-4 text-white/60" />
                  </div>
                  <span className="text-sm font-semibold tracking-wider text-white">MAGNATA</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar">
                {navItems.map((g) => (
                  <div key={g.group}>
                    <p className="text-[10px] uppercase tracking-wider text-white/25 px-2 mb-2">{g.group}</p>
                    <div className="space-y-1">
                      {g.items.map((item) => (
                        <button
                          key={item.tab}
                          onClick={() => { setAdminTab(item.tab); setSidebarOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            adminTab === item.tab ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="bg-white/5 my-4" />
              <button
                onClick={() => { setIsAdmin(false); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
              >
                <Store className="w-4 h-4" />
                Ver Loja
              </button>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="glass-nav h-14 sticky top-0 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setSidebarOpen(true)} className="text-white/50 hover:text-white/80 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
              <Key className="w-3.5 h-3.5 text-white/60" />
            </div>
            <span className="text-sm font-bold tracking-wider text-white/90">MAGNATA</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button
              variant="ghost" size="sm"
              onClick={() => setIsAdmin(false)}
              className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"
            >
              <Store className="w-4 h-4 mr-1.5" />
              LOJA
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm"
              onClick={() => setShowLoginModal(true)}
              className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"
            >
              <Lock className="w-4 h-4 mr-1.5" />
              ADMIN
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full p-4 md:p-6">
        <AnimatePresence mode="wait">
          {!isAdmin ? (
            /* ====== STORE VIEW ====== */
            <motion.div key="store" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              {/* Buy Result */}
              {deliveredKey ? (
                <div className="max-w-lg mx-auto mt-8">
                  <div className="glass-strong rounded-xl p-8 text-center space-y-5">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h2 className="text-lg font-bold tracking-wider text-white">Key Gerada</h2>
                      <p className="text-sm text-white/50 mt-1">{deliveredProduct}</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                      <div className="glass-input rounded-xl p-4 flex items-center justify-between gap-3">
                        <code className="text-emerald-400 font-mono text-sm break-all text-left">{deliveredKey}</code>
                        <Button size="sm" variant="ghost" onClick={() => copyKey(deliveredKey)} className="text-white/30 hover:text-white/60 shrink-0">
                          {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-[11px] text-white/20 mt-3">Copie sua key agora. Ela nao sera exibida novamente.</p>
                    </motion.div>
                    <Button variant="ghost" onClick={() => setDeliveredKey(null)} className="text-white/40 hover:text-white/70 hover:bg-white/5 text-xs tracking-wider">
                      COMPRAR OUTRA
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <Key className="w-5 h-5 text-white/40" />
                    <h1 className="text-xl font-bold tracking-wider text-white">Gerar Key</h1>
                  </div>
                  {loadingProducts ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="glass rounded-xl p-6 space-y-4"><div className="skeleton-shimmer h-5 w-32 rounded-lg" /><div className="skeleton-shimmer h-4 w-24 rounded-lg" /><div className="skeleton-shimmer h-10 w-full rounded-xl" /></div>
                      ))}
                    </div>
                  ) : activeProducts.length === 0 ? (
                    <div className="glass rounded-xl p-12 text-center">
                      <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-sm text-white/30">Nenhum produto disponivel.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeProducts.map((product, i) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="glass glass-hover rounded-xl p-5 h-full flex flex-col"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-sm font-semibold text-white">{product.name}</h3>
                              <p className="text-xs text-white/40 mt-0.5">{product.description || product.duration}</p>
                            </div>
                            <Badge className="bg-white/5 text-white/60 border-white/10 text-[10px] hover:bg-white/10">
                              <Coins className="w-3 h-3 mr-1" />
                              {product.credits}
                            </Badge>
                          </div>
                          <div className="space-y-2 flex-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/40">Duracao</span>
                              <span className="text-white/80 font-medium">{product.duration}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-white/40">Custo</span>
                              <span className="text-emerald-400 font-semibold">{product.credits} credito{product.credits > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-white/40">Estoque</span>
                              <span className={product._count.keys > 0 ? 'text-white/80' : 'text-red-400'}>
                                {product._count.keys} disponive{l}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <input
                              placeholder="Seu nome ou email..."
                              value={buyerInfo}
                              onChange={(e) => setBuyerInfo(e.target.value)}
                              disabled={product._count.keys === 0}
                              className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 font-mono"
                            />
                            <button
                              disabled={product._count.keys === 0 || buyingProductId === product.id}
                              onClick={() => handleBuy(product.id)}
                              className="w-full h-9 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              {buyingProductId === product.id ? (
                                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                              ) : product._count.keys === 0 ? (
                                'ESGOTADO'
                              ) : (
                                <><Key className="w-3.5 h-3.5" /> GERAR KEY</>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            /* ====== ADMIN VIEW ====== */
            <motion.div key="admin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Produtos Ativos', value: activeProducts.length, color: 'text-white' },
                  { label: 'Keys em Estoque', value: activeProducts.reduce((s, p) => s + p._count.keys, 0), color: 'text-emerald-400' },
                  { label: 'Vendas Totais', value: stats.totalSales, color: 'text-white' },
                  { label: 'Creditos Movidos', value: stats.totalCredits, color: 'text-amber-400' },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="glass rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-wider text-white/30">{s.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Tabs value={adminTab} onValueChange={setAdminTab}>
                <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 mb-4 w-full sm:w-auto">
                  {[
                    { value: 'products', icon: Key, label: 'Produtos & Keys' },
                    { value: 'stock', icon: Package, label: 'Estoque' },
                    { value: 'sales', icon: History, label: 'Historico' },
                  ].map((t) => (
                    <TabsTrigger
                      key={t.value} value={t.value}
                      className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 rounded-lg text-xs tracking-wider gap-1.5"
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Products Tab */}
                <TabsContent value="products" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-white/40" />
                      Novo Produto
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input placeholder="Nome" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="Duracao (1 dia)" value={newProduct.duration} onChange={(e) => setNewProduct({ ...newProduct, duration: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input type="number" placeholder="Creditos" value={newProduct.credits} onChange={(e) => setNewProduct({ ...newProduct, credits: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <button onClick={handleCreateProduct} className="h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        CRIAR
                      </button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4">Produtos Cadastrados</h3>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                      {products.length === 0 ? (
                        <p className="text-sm text-white/30 text-center py-6">Nenhum produto cadastrado.</p>
                      ) : products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">{p.name}</span>
                              {!p.isActive && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Inativo</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                              <span>{p.duration}</span>
                              <span className="text-emerald-400">{p.credits} cr.</span>
                              <span className={p._count.keys > 0 ? 'text-emerald-400' : 'text-red-400'}>{p._count.keys} keys</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteProduct(p.id, p.name)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Stock Tab */}
                <TabsContent value="stock" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-1 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-white/40" />
                      Adicionar Keys
                    </h3>
                    <p className="text-[11px] text-white/25 mb-4">Cole uma key por linha</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <select value={addingKeysTo} onChange={(e) => setAddingKeysTo(e.target.value)} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white/80">
                        <option value="">Selecione...</option>
                        {products.filter((p) => p.isActive).map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.credits} cr.)</option>))}
                      </select>
                      <div className="sm:col-span-2">
                        <Textarea value={newKeysText} onChange={(e) => setNewKeysText(e.target.value)} rows={3} placeholder="Cole as keys aqui..." className="glass-input rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-white/15 resize-none min-h-[88px]" />
                      </div>
                      <button onClick={handleAddKeys} disabled={!addingKeysTo || !newKeysText.trim()} className="h-auto rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors disabled:opacity-30 flex items-center justify-center gap-1.5 py-3">
                        <Plus className="w-3.5 h-3.5" />
                        ADICIONAR
                      </button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white">Keys Cadastradas</h3>
                      <div className="flex gap-2 items-center">
                        <select value={selectedProductId} onChange={(e) => { setSelectedProductId(e.target.value); fetchKeys(e.target.value || undefined); }} className="glass-input rounded-lg px-2 py-1 text-[11px] text-white/60">
                          <option value="">Todos</option>
                          {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        <button onClick={() => fetchKeys(selectedProductId || undefined)} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {keys.length === 0 ? (
                        <div className="text-center py-8"><Hash className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhuma key encontrada.</p></div>
                      ) : keys.map((k) => (
                        <div key={k.id} className={`flex items-center justify-between p-2.5 rounded-lg ${k.isSold ? 'opacity-40' : 'bg-white/[0.02]'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-white/80 truncate">{k.code}</code>
                              {k.isSold ? <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Vendida</Badge> : <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Disponivel</Badge>}
                            </div>
                            <p className="text-[10px] text-white/25 mt-0.5">{k.product.name} — {k.product.duration}</p>
                          </div>
                          {!k.isSold && <button onClick={() => handleDeleteKey(k.id)} className="text-white/20 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Sales Tab */}
                <TabsContent value="sales" className="mt-0">
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-white/40" />
                        Historico de Vendas
                      </h3>
                      <button onClick={fetchTransactions} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {transactions.length === 0 ? (
                        <div className="text-center py-8"><History className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhuma venda registrada.</p></div>
                      ) : transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{t.productName}</span>
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{t.credits} cr.</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/30">
                              <span>{t.buyerInfo}</span>
                              <code className="text-emerald-400/70 font-mono">{t.key.code}</code>
                            </div>
                          </div>
                          <span className="text-[11px] text-white/20 shrink-0 ml-3">{new Date(t.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-[11px] text-white/15 tracking-wider">Magnata Key Generator</p>
        </div>
      </footer>

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="glass-strong rounded-2xl max-w-sm p-6 bg-transparent border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white text-base tracking-wider font-bold">Acesso Admin</DialogTitle>
            <DialogDescription className="text-white/30 text-xs">Digite a senha de administrador</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <input
              type="password" placeholder="Senha..."
              value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="glass-input flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20"
            />
            <button onClick={handleLogin} disabled={loggingIn} className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 transition-colors disabled:opacity-50">
              {loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}