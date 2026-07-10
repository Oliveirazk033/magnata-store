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
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Starfield from '@/components/Starfield';
import {
  Key, Shield, Plus, Trash2, RefreshCw, Coins, ArrowRight,
  Lock, Unlock, History, Copy, Check, Store, BarChart3,
  Package, BookOpen, X, LayoutDashboard, Hash, User, UserPlus, LogIn, LogOut, Wallet, Play, Link2, ExternalLink,
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
interface UserData {
  id: string; username: string; displayName: string;
  credits: number; isActive: boolean; createdAt: string;
}
interface LoggedUser {
  id: string; username: string; displayName: string; credits: number;
}
interface TutorialItem {
  id: string; title: string; url: string; embedUrl: string;
  sortOrder: number; isActive: boolean; createdAt: string;
}
interface LinkItem {
  id: string; title: string; url: string; description: string | null;
  sortOrder: number; isActive: boolean; createdAt: string;
}

/* ===== Main ===== */
export default function Home() {
  // Auth states
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // User states
  const [loggedUser, setLoggedUser] = useState<LoggedUser | null>(null);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [userLoggingIn, setUserLoggingIn] = useState(false);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [stats, setStats] = useState({ totalCredits: 0, totalSales: 0 });
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [deliveredKey, setDeliveredKey] = useState<string | null>(null);
  const [deliveredProduct, setDeliveredProduct] = useState('');
  const [remainingCredits, setRemainingCredits] = useState(0);

  // Admin form states
  const [newProduct, setNewProduct] = useState({ name: '', description: '', duration: '', credits: '' });
  const [newKeysText, setNewKeysText] = useState('');
  const [addingKeysTo, setAddingKeysTo] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [adminTab, setAdminTab] = useState('products');
  const [userTab, setUserTab] = useState('generate');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // User management
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', credits: '10' });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState('');

  // Tutorials
  const [tutorials, setTutorials] = useState<TutorialItem[]>([]);
  const [userTutorials, setUserTutorials] = useState<TutorialItem[]>([]);
  const [newTutorial, setNewTutorial] = useState({ title: '', url: '' });

  // Links
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [userLinks, setUserLinks] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });

  const getUserHeaders = () => loggedUser ? ({ 'x-user-id': loggedUser.id }) : {};
  const getAdminHeaders = () => ({ 'x-admin-key': adminPassword });

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
      const res = await fetch('/api/transactions', { headers: { 'x-admin-key': adminPassword } });
      const data = await res.json();
      if (data.transactions) { setTransactions(data.transactions); setStats({ totalCredits: data.totalCredits, totalSales: data.totalSales }); }
    } catch { /* silent */ }
  }, [adminPassword]);

  const fetchKeys = useCallback(async (productId?: string) => {
    try {
      const url = productId ? `/api/keys?productId=${productId}` : '/api/keys';
      const res = await fetch(url, { headers: { 'x-admin-key': adminPassword } });
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch { /* silent */ }
  }, [adminPassword]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/register', { headers: { 'x-admin-key': adminPassword } });
      const data = await res.json();
      if (data.users) setUsers(data.users);
      else if (data.error) { toast.error('Erro usuarios: ' + data.error); }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Erro'; toast.error('Fetch users: ' + msg); }
  }, [adminPassword]);

  const fetchTutorials = useCallback(async (isAdminFetch: boolean) => {
    try {
      const headers = isAdminFetch ? { 'x-admin-key': adminPassword } : {};
      const res = await fetch('/api/tutorials', { headers });
      const data = await res.json();
      if (data.tutorials) {
        if (isAdminFetch) setTutorials(data.tutorials);
        else setUserTutorials(data.tutorials);
      }
    } catch { /* silent */ }
  }, [adminPassword]);

  const fetchUserTutorials = useCallback(async () => {
    try {
      const res = await fetch('/api/tutorials');
      const data = await res.json();
      if (data.tutorials) setUserTutorials(data.tutorials);
    } catch { /* silent */ }
  }, []);

  const fetchLinks = useCallback(async (isAdminFetch: boolean) => {
    try {
      const headers = isAdminFetch ? { 'x-admin-key': adminPassword } : {};
      const res = await fetch('/api/links', { headers });
      const data = await res.json();
      if (data.links) {
        if (isAdminFetch) setLinks(data.links);
        else setUserLinks(data.links);
      }
    } catch { /* silent */ }
  }, [adminPassword]);

  const fetchUserLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      if (data.links) setUserLinks(data.links);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); fetchUserTutorials(); fetchUserLinks(); }, [fetchProducts, fetchUserTutorials, fetchUserLinks]);
  useEffect(() => {
    if (isAdmin) { fetchTransactions(); fetchKeys(); fetchUsers(); fetchTutorials(true); fetchLinks(true); }
  }, [isAdmin, fetchTransactions, fetchKeys, fetchUsers, fetchTutorials, fetchLinks]);

  // Refresh user credits after login
  const refreshUser = async () => {
    if (!loggedUser) return;
    try {
      const res = await fetch('/api/auth/login', { headers: { 'x-user-id': loggedUser.id } });
      const data = await res.json();
      if (data.user) setLoggedUser(data.user);
    } catch { /* silent */ }
  };

  // === HANDLERS ===
  const handleAdminLogin = async () => {
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword }) });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        toast.success('Login admin realizado');
        // Fetch admin data directly after login
        setTimeout(async () => {
          const headers = { 'x-admin-key': adminPassword };
          try {
            const [tRes, kRes, uRes, tutRes, lnkRes] = await Promise.all([
              fetch('/api/transactions', { headers }),
              fetch('/api/keys', { headers }),
              fetch('/api/auth/register', { headers }),
              fetch('/api/tutorials', { headers }),
              fetch('/api/links', { headers }),
            ]);
            const [tData, kData, uData, tutData, lnkData] = await Promise.all([tRes.json(), kRes.json(), uRes.json(), tutRes.json(), lnkRes.json()]);
            if (tData.transactions) { setTransactions(tData.transactions); setStats({ totalCredits: tData.totalCredits, totalSales: tData.totalSales }); }
            if (kData.keys) setKeys(kData.keys);
            if (uData.users) setUsers(uData.users);
            if (tutData.tutorials) setTutorials(tutData.tutorials);
            if (lnkData.links) setLinks(lnkData.links);
          } catch (err) { console.error('Admin data fetch error:', err); }
        }, 100);
      }
      else toast.error('Senha incorreta');
    } catch { toast.error('Erro ao fazer login'); }
    finally { setLoggingIn(false); }
  };

  const handleUserLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) { toast.error('Preencha usuário e senha'); return; }
    setUserLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) });
      const data = await res.json();
      if (data.success) {
        setLoggedUser(data.user);
        setShowUserLogin(false);
        setLoginUsername('');
        setLoginPassword('');
        toast.success(`Bem-vindo, ${data.user.displayName}!`);
      } else toast.error(data.error || 'Erro no login');
    } catch { toast.error('Erro ao fazer login'); }
    finally { setUserLoggingIn(false); }
  };

  const handleUserLogout = () => {
    setLoggedUser(null);
    setDeliveredKey(null);
    toast.success('Desconectado');
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.displayName) { alert('Preencha todos os campos'); return; }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (data.user) {
        toast.success(`Usuario "${data.user.displayName}" criado com ${data.user.credits} creditos!`);
        setNewUser({ username: '', password: '', displayName: '', credits: '10' });
        fetchUsers();
      } else { alert('Erro: ' + (data.error || 'Erro ao criar')); toast.error(data.error || 'Erro ao criar'); }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Erro'; alert('Catch: ' + msg); }
  };

  const handleUpdateCredits = async (userId: string, credits: number) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ userId, credits }),
      });
      const data = await res.json();
      if (data.user) { toast.success(`Creditos atualizados para ${data.user.credits}`); setEditingUser(null); fetchUsers(); }
      else { alert('Erro: ' + (data.error || 'Erro')); toast.error(data.error || 'Erro'); }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Erro'; alert('Catch: ' + msg); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Deletar este usuário?')) return;
    try {
      const res = await fetch(`/api/auth/register?id=${userId}`, { method: 'DELETE', headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('Usuario removido'); fetchUsers(); }
      else { alert('Erro: ' + (data.error || 'Erro')); toast.error(data.error || 'Erro'); }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Erro'; alert('Catch: ' + msg); }
  };

  const handleCreateTutorial = async () => {
    if (!newTutorial.title.trim() || !newTutorial.url.trim()) { toast.error('Preencha titulo e URL do video'); return; }
    try {
      const res = await fetch('/api/tutorials', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify(newTutorial),
      });
      const data = await res.json();
      if (data.tutorial) {
        toast.success(`Tutorial "${data.tutorial.title}" adicionado!`);
        setNewTutorial({ title: '', url: '' });
        fetchTutorials(true);
      } else { toast.error(data.error || 'Erro ao criar tutorial'); }
    } catch { toast.error('Erro'); }
  };

  const handleDeleteTutorial = async (id: string) => {
    if (!confirm('Remover este tutorial?')) return;
    try {
      const res = await fetch(`/api/tutorials?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('Tutorial removido'); fetchTutorials(true); }
      else toast.error(data.error || 'Erro');
    } catch { toast.error('Erro'); }
  };

  const handleCreateLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) { toast.error('Preencha titulo e URL do link'); return; }
    try {
      const res = await fetch('/api/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify(newLink),
      });
      const data = await res.json();
      if (data.link) {
        toast.success(`Link "${data.link.title}" adicionado!`);
        setNewLink({ title: '', url: '', description: '' });
        fetchLinks(true);
      } else { toast.error(data.error || 'Erro ao criar link'); }
    } catch { toast.error('Erro'); }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Remover este link?')) return;
    try {
      const res = await fetch(`/api/links?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('Link removido'); fetchLinks(true); }
      else toast.error(data.error || 'Erro');
    } catch { toast.error('Erro'); }
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
    if (!loggedUser) { setShowUserLogin(true); return; }
    setBuyingProductId(productId); setDeliveredKey(null);
    try {
      const res = await fetch('/api/buy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': loggedUser.id }, body: JSON.stringify({ productId }) });
      const data = await res.json();
      if (data.success) {
        setDeliveredKey(data.key);
        setDeliveredProduct(data.product);
        setRemainingCredits(data.remainingCredits);
        setLoggedUser({ ...loggedUser, credits: data.remainingCredits });
        toast.success('Key gerada!'); fetchProducts();
      } else { toast.error(data.error || 'Erro'); alert('Erro: ' + (data.error || 'Erro')); }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Erro de rede'; toast.error(msg); alert('Catch: ' + msg); }
    finally { setBuyingProductId(null); }
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); };
  const activeProducts = products.filter((p) => p.isActive);

  const userNavItems = [
    { icon: Key, label: 'Gerar Key', tab: 'generate' },
    { icon: Play, label: 'Tutoriais', tab: 'tutorials' },
    { icon: Link2, label: 'Links', tab: 'links' },
  ];

  const navItems = isAdmin
    ? [
        { group: 'Principal', items: [{ icon: LayoutDashboard, label: 'Dashboard', tab: 'products' }] },
        { group: 'Estoque', items: [{ icon: Key, label: 'Produtos & Keys', tab: 'products' }, { icon: Package, label: 'Estoque', tab: 'stock' }, { icon: History, label: 'Historico', tab: 'sales' }] },
        { group: 'Sistema', items: [{ icon: User, label: 'Usuarios', tab: 'users' }, { icon: Play, label: 'Tutoriais', tab: 'tutorials' }, { icon: Link2, label: 'Links', tab: 'links' }] },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white relative">
      <Starfield />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
            <motion.nav
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[260px] z-50 flex flex-col p-4"
              style={{ background: 'linear-gradient(180deg, rgba(8,8,8,0.78), rgba(4,4,4,0.72))', backdropFilter: 'blur(36px) saturate(180%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><Key className="w-4 h-4 text-white/60" /></div>
                  <span className="text-sm font-semibold tracking-wider text-white">Gerador Magnata</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-white/30 hover:text-white/60 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar">
                {isAdmin ? (
                  navItems.map((g) => (
                    <div key={g.group}>
                      <p className="text-[10px] uppercase tracking-wider text-white/25 px-2 mb-2">{g.group}</p>
                      <div className="space-y-1">
                        {g.items.map((item) => (
                          <button key={item.tab} onClick={() => { setAdminTab(item.tab); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${adminTab === item.tab ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}>
                            <item.icon className="w-4 h-4" />{item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-1">
                    {userNavItems.map((item) => (
                      <button key={item.tab} onClick={() => { setUserTab(item.tab); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${userTab === item.tab ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}>
                        <item.icon className="w-4 h-4" />{item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Separator className="bg-white/5 my-4" />
              {isAdmin ? (
                <button onClick={() => { setIsAdmin(false); setSidebarOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors">
                  <Store className="w-4 h-4" />Ver Loja
                </button>
              ) : (
                <button onClick={() => { setShowAdminLogin(true); setSidebarOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors">
                  <Lock className="w-4 h-4" />Admin
                </button>
              )}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="glass-nav h-14 sticky top-0 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/50 hover:text-white/80 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10"><Key className="w-3.5 h-3.5 text-white/60" /></div>
            <span className="text-sm font-bold tracking-wider text-white/90">Gerador Magnata</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsAdmin(false)} className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"><Store className="w-4 h-4 mr-1.5" />LOJA</Button>
              <Button variant="ghost" size="sm" onClick={() => { setIsAdmin(false); }} className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"><LogOut className="w-4 h-4 mr-1.5" />SAIR</Button>
            </>
          ) : loggedUser ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">{loggedUser.credits}</span>
                <span className="text-[10px] text-white/30">créditos</span>
              </div>
              <span className="text-xs text-white/60 hidden sm:inline">{loggedUser.displayName}</span>
              <Button variant="ghost" size="sm" onClick={handleUserLogout} className="text-white/50 hover:text-red-400 hover:bg-white/5 text-xs"><LogOut className="w-4 h-4" /></Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowUserLogin(true)} className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"><LogIn className="w-4 h-4 mr-1.5" />LOGIN</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdminLogin(true)} className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs tracking-wider"><Lock className="w-4 h-4 mr-1.5" />ADMIN</Button>
            </>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full p-4 md:p-6">
        <AnimatePresence mode="wait">
          {!isAdmin ? (
            /* ====== STORE VIEW ====== */
            <motion.div key="store" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              {deliveredKey ? (
                <div className="max-w-lg mx-auto mt-8">
                  <div className="glass-strong rounded-xl p-8 text-center space-y-5">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"><Shield className="w-8 h-8 text-emerald-400" /></div>
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
                      <p className="text-[11px] text-amber-400/60 mt-1">Créditos restantes: {remainingCredits}</p>
                    </motion.div>
                    <Button variant="ghost" onClick={() => { setDeliveredKey(null); refreshUser(); }} className="text-white/40 hover:text-white/70 hover:bg-white/5 text-xs tracking-wider">COMPRAR OUTRA</Button>
                  </div>
                </div>
              ) : userTab === 'generate' ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <Key className="w-5 h-5 text-white/40" />
                    <h1 className="text-xl font-bold tracking-wider text-white">Gerar Key</h1>
                  </div>
                  {loadingProducts ? (
                    <div className="glass rounded-xl p-6 space-y-4"><div className="skeleton-shimmer h-5 w-48 rounded-lg" /><div className="skeleton-shimmer h-12 w-full rounded-xl" /><div className="skeleton-shimmer h-12 w-full rounded-xl" /></div>
                  ) : activeProducts.length === 0 ? (
                    <div className="glass rounded-xl p-12 text-center"><Package className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/30">Nenhum produto disponivel.</p></div>
                  ) : !loggedUser ? (
                    <div className="glass rounded-xl p-12 text-center">
                      <Lock className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-sm text-white/30 mb-4">Faca login para gerar keys.</p>
                      <button onClick={() => setShowUserLogin(true)} className="h-10 px-6 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors">FAZER LOGIN</button>
                    </div>
                  ) : (
                    <div className="glass rounded-xl p-5 space-y-4 max-w-md">
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-white/30 mb-2 block">Selecione o produto</label>
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white bg-transparent"
                        >
                          <option value="">Escolha...</option>
                          {activeProducts.map((p) => (
                            <option key={p.id} value={p.id} disabled={p._count.keys === 0}>
                              {p.name} — {p.duration} — {p.credits} cr. ({p._count.keys} disp.)
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedProductId && (() => {
                        const prod = activeProducts.find((p) => p.id === selectedProductId);
                        if (!prod) return null;
                        return (
                          <div className="space-y-2 px-1">
                            <div className="flex justify-between text-xs"><span className="text-white/40">Custo</span><span className="text-emerald-400 font-semibold">{prod.credits} credito{prod.credits > 1 ? 's' : ''}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-white/40">Estoque</span><span className={prod._count.keys > 0 ? 'text-white/80' : 'text-red-400'}>{prod._count.keys} disponiveis</span></div>
                            <div className="flex justify-between text-xs"><span className="text-white/40">Seus creditos</span><span className={loggedUser.credits >= prod.credits ? 'text-amber-400 font-semibold' : 'text-red-400 font-semibold'}>{loggedUser.credits} cr.</span></div>
                          </div>
                        );
                      })()}
                      <button
                        disabled={!selectedProductId || buyingProductId === selectedProductId || (() => { const p = activeProducts.find((p) => p.id === selectedProductId); return p ? (p._count.keys === 0 || loggedUser.credits < p.credits) : true; })()}
                        onClick={() => selectedProductId && handleBuy(selectedProductId)}
                        className="w-full h-11 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {buyingProductId === selectedProductId ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Key className="w-4 h-4" /> GERAR KEY</>)}
                      </button>
                    </div>
                  )}
                </>
              ) : userTab === 'tutorials' ? (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Play className="w-5 h-5 text-white/40" />
                    <h1 className="text-xl font-bold tracking-wider text-white">Tutoriais</h1>
                  </div>
                  {userTutorials.length === 0 ? (
                    <div className="glass rounded-xl p-12 text-center"><Play className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/30">Nenhum tutorial disponivel.</p></div>
                  ) : (
                    <div className="space-y-4">
                      {userTutorials.map((t) => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="glass rounded-xl overflow-hidden">
                          <p className="text-sm font-semibold text-white px-5 pt-4 pb-2">{t.title}</p>
                          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                              src={t.embedUrl}
                              title={t.title}
                              className="absolute inset-0 w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ) : userTab === 'links' ? (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Link2 className="w-5 h-5 text-white/40" />
                    <h1 className="text-xl font-bold tracking-wider text-white">Links</h1>
                  </div>
                  {userLinks.length === 0 ? (
                    <div className="glass rounded-xl p-12 text-center"><Link2 className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/30">Nenhum link disponivel.</p></div>
                  ) : (
                    <div className="space-y-3">
                      {userLinks.map((lnk, i) => (
                        <motion.a
                          key={lnk.id}
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                          className="glass glass-hover rounded-xl p-4 flex items-center gap-4 group cursor-pointer block"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                            <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-white/90 transition-colors">{lnk.title}</p>
                            {lnk.description && <p className="text-xs text-white/30 mt-0.5 truncate">{lnk.description}</p>}
                            <p className="text-[11px] text-white/15 mt-1 truncate">{lnk.url}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </motion.a>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          ) : (
            /* ====== ADMIN VIEW ====== */
            <motion.div key="admin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Produtos Ativos', value: activeProducts.length, color: 'text-white' },
                  { label: 'Keys em Estoque', value: activeProducts.reduce((s, p) => s + p._count.keys, 0), color: 'text-emerald-400' },
                  { label: 'Vendas Totais', value: stats.totalSales, color: 'text-white' },
                  { label: 'Usuarios', value: users.length, color: 'text-blue-400' },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="glass rounded-xl p-4"><p className="text-[10px] uppercase tracking-wider text-white/30">{s.label}</p><p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p></div>
                  </motion.div>
                ))}
              </div>

              <Tabs value={adminTab} onValueChange={setAdminTab}>
                <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 mb-4 w-full sm:w-auto flex-wrap">
                  {[
                    { value: 'products', icon: Key, label: 'Produtos' },
                    { value: 'stock', icon: Package, label: 'Estoque' },
                    { value: 'sales', icon: History, label: 'Historico' },
                    { value: 'users', icon: User, label: 'Usuarios' },
                    { value: 'tutorials', icon: Play, label: 'Tutoriais' },
                    { value: 'links', icon: Link2, label: 'Links' },
                  ].map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 rounded-lg text-xs tracking-wider gap-1.5">
                      <t.icon className="w-3.5 h-3.5" />{t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Products Tab */}
                <TabsContent value="products" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-white/40" />Novo Produto</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input placeholder="Nome" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="Duracao (1 dia)" value={newProduct.duration} onChange={(e) => setNewProduct({ ...newProduct, duration: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input type="number" placeholder="Creditos" value={newProduct.credits} onChange={(e) => setNewProduct({ ...newProduct, credits: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <button onClick={handleCreateProduct} className="h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"><Plus className="w-3.5 h-3.5" />CRIAR</button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4">Produtos Cadastrados</h3>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                      {products.length === 0 ? (<p className="text-sm text-white/30 text-center py-6">Nenhum produto.</p>) : products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><span className="text-sm font-medium text-white truncate">{p.name}</span>{!p.isActive && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Inativo</Badge>}</div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40"><span>{p.duration}</span><span className="text-emerald-400">{p.credits} cr.</span><span className={p._count.keys > 0 ? 'text-emerald-400' : 'text-red-400'}>{p._count.keys} keys</span></div>
                          </div>
                          <button onClick={() => handleDeleteProduct(p.id, p.name)} className="text-white/20 hover:text-red-400 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Stock Tab */}
                <TabsContent value="stock" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-1 flex items-center gap-2"><Plus className="w-4 h-4 text-white/40" />Adicionar Keys</h3>
                    <p className="text-[11px] text-white/25 mb-4">Cole uma key por linha</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <select value={addingKeysTo} onChange={(e) => setAddingKeysTo(e.target.value)} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white/80">
                        <option value="">Selecione...</option>
                        {products.filter((p) => p.isActive).map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.credits} cr.)</option>))}
                      </select>
                      <div className="sm:col-span-2"><Textarea value={newKeysText} onChange={(e) => setNewKeysText(e.target.value)} rows={3} placeholder="Cole as keys aqui..." className="glass-input rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-white/15 resize-none min-h-[88px]" /></div>
                      <button onClick={handleAddKeys} disabled={!addingKeysTo || !newKeysText.trim()} className="h-auto rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors disabled:opacity-30 flex items-center justify-center gap-1.5 py-3"><Plus className="w-3.5 h-3.5" />ADICIONAR</button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white">Keys Cadastradas</h3>
                      <div className="flex gap-2 items-center">
                        <select value={selectedProductId} onChange={(e) => { setSelectedProductId(e.target.value); fetchKeys(e.target.value || undefined); }} className="glass-input rounded-lg px-2 py-1 text-[11px] text-white/60"><option value="">Todos</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                        <button onClick={() => fetchKeys(selectedProductId || undefined)} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {keys.length === 0 ? (<div className="text-center py-8"><Hash className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhuma key.</p></div>) : keys.map((k) => (
                        <div key={k.id} className={`flex items-center justify-between p-2.5 rounded-lg ${k.isSold ? 'opacity-40' : 'bg-white/[0.02]'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><code className="text-xs font-mono text-white/80 truncate">{k.code}</code>{k.isSold ? <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Vendida</Badge> : <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Disponivel</Badge>}</div>
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
                      <h3 className="text-sm font-semibold tracking-wider text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-white/40" />Historico de Vendas</h3>
                      <button onClick={fetchTransactions} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {transactions.length === 0 ? (<div className="text-center py-8"><History className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhuma venda.</p></div>) : transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><span className="text-sm font-medium text-white">{t.productName}</span><Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{t.credits} cr.</Badge></div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/30"><span>{t.buyerInfo}</span><code className="text-emerald-400/70 font-mono">{t.key.code}</code></div>
                          </div>
                          <span className="text-[11px] text-white/20 shrink-0 ml-3">{new Date(t.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Users Tab */}
                <TabsContent value="users" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-white/40" />Novo Usuario</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      <input placeholder="Usuario" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input type="password" placeholder="Senha" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="Nome visivel" value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input type="number" placeholder="Creditos" value={newUser.credits} onChange={(e) => setNewUser({ ...newUser, credits: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <button onClick={handleCreateUser} className="h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"><UserPlus className="w-3.5 h-3.5" />CRIAR</button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white">Usuarios Cadastrados</h3>
                      <button onClick={fetchUsers} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {users.length === 0 ? (<div className="text-center py-8"><User className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhum usuario.</p></div>) : users.map((u) => (
                        <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg bg-white/[0.02] ${!u.isActive ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{u.displayName}</span>
                              {!u.isActive && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Inativo</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                              <span>@{u.username}</span>
                              <span className="text-white/20">desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {editingUser === u.id ? (
                              <div className="flex items-center gap-1">
                                <input type="number" value={editCredits} onChange={(e) => setEditCredits(e.target.value)} className="glass-input rounded-lg px-2 py-1 text-xs text-white w-20" />
                                <button onClick={() => handleUpdateCredits(u.id, Number(editCredits))} className="text-emerald-400 hover:text-emerald-300 p-1"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingUser(null)} className="text-white/30 hover:text-white/60 p-1"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingUser(u.id); setEditCredits(String(u.credits)); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-semibold text-amber-400">{u.credits}</span>
                              </button>
                            )}
                            <button onClick={() => handleDeleteUser(u.id)} className="text-white/20 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Tutorials Tab */}
                <TabsContent value="tutorials" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4 flex items-center gap-2"><Play className="w-4 h-4 text-white/40" />Adicionar Tutorial</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input placeholder="Titulo do video" value={newTutorial.title} onChange={(e) => setNewTutorial({ ...newTutorial, title: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="URL do video (YouTube...)" value={newTutorial.url} onChange={(e) => setNewTutorial({ ...newTutorial, url: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <button onClick={handleCreateTutorial} className="h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5" />ADICIONAR</button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white">Tutoriais Cadastrados</h3>
                      <button onClick={() => fetchTutorials(true)} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {tutorials.length === 0 ? (
                        <div className="text-center py-8"><Play className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhum tutorial.</p></div>
                      ) : tutorials.map((t) => (
                        <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white/[0.02]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{t.title}</p>
                            <p className="text-[11px] text-white/30 mt-0.5 truncate">{t.url}</p>
                          </div>
                          <button onClick={() => handleDeleteTutorial(t.id)} className="text-white/20 hover:text-red-400 transition-colors p-1 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Links Tab */}
                <TabsContent value="links" className="space-y-3 mt-0">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold tracking-wider text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-white/40" />Adicionar Link</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input placeholder="Titulo do link" value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="URL (https://...)" value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <input placeholder="Descricao (opcional)" value={newLink.description} onChange={(e) => setNewLink({ ...newLink, description: e.target.value })} className="glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
                      <button onClick={handleCreateLink} className="h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"><Plus className="w-3.5 h-3.5" />ADICIONAR</button>
                    </div>
                  </div>
                  <div className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-wider text-white">Links Cadastrados</h3>
                      <button onClick={() => fetchLinks(true)} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                      {links.length === 0 ? (
                        <div className="text-center py-8"><Link2 className="w-8 h-8 text-white/10 mx-auto mb-2" /><p className="text-sm text-white/20">Nenhum link.</p></div>
                      ) : links.map((l) => (
                        <div key={l.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white/[0.02]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{l.title}</p>
                              {!l.isActive && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Inativo</Badge>}
                            </div>
                            <p className="text-[11px] text-white/30 mt-0.5 truncate">{l.url}</p>
                            {l.description && <p className="text-[11px] text-white/20 mt-0.5">{l.description}</p>}
                          </div>
                          <button onClick={() => handleDeleteLink(l.id)} className="text-white/20 hover:text-red-400 transition-colors p-1 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
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

      <footer className="relative z-10 border-t border-white/[0.05] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center"><p className="text-[11px] text-white/15 tracking-wider">Magnata Key Generator</p></div>
      </footer>

      {/* Admin Login Modal */}
      <Dialog open={showAdminLogin} onOpenChange={setShowAdminLogin}>
        <DialogContent className="glass-strong rounded-2xl max-w-sm p-6 bg-transparent border-white/10">
          <DialogHeader><DialogTitle className="text-white text-base tracking-wider font-bold">Acesso Admin</DialogTitle><DialogDescription className="text-white/30 text-xs">Digite a senha de administrador</DialogDescription></DialogHeader>
          <div className="flex gap-2 mt-4">
            <input type="password" placeholder="Senha..." value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} className="glass-input flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
            <button onClick={handleAdminLogin} disabled={loggingIn} className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 transition-colors disabled:opacity-50">{loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Login Modal */}
      <Dialog open={showUserLogin} onOpenChange={setShowUserLogin}>
        <DialogContent className="glass-strong rounded-2xl max-w-sm p-6 bg-transparent border-white/10">
          <DialogHeader><DialogTitle className="text-white text-base tracking-wider font-bold">Login</DialogTitle><DialogDescription className="text-white/30 text-xs">Entre com seu usuario e senha</DialogDescription></DialogHeader>
          <div className="space-y-3 mt-4">
            <input placeholder="Usuario..." value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
            <input type="password" placeholder="Senha..." value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUserLogin()} className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20" />
            <button onClick={handleUserLogin} disabled={userLoggingIn} className="w-full h-10 rounded-xl bg-white text-black text-xs font-medium tracking-wider hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {userLoggingIn ? <><RefreshCw className="w-4 h-4 animate-spin" /> Entrando...</> : <><LogIn className="w-4 h-4" /> ENTRAR</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}