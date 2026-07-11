'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Key, Bell, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Header, type User, type Tab } from '@/components/store/header'
import { ProductCard, type Product } from '@/components/store/product-card'
import { Checkout, type Order } from '@/components/store/checkout'
import { MyProducts } from '@/components/store/my-products'
import { AdminPanel } from '@/components/store/admin-panel'

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('loja')
  const [searchQuery, setSearchQuery] = useState('')
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      // silent
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch {
      // silent
    }
  }, [user])

  useEffect(() => {
    fetchUser()
    fetchProducts()
  }, [fetchUser, fetchProducts])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user, fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markNotificationsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // silent
    }
  }

  const handleTabChange = (tab: Tab) => {
    if (tab === 'carrinho') {
      if (!user) {
        toast.error('Faca login para acessar o carrinho')
        return
      }
      if (!checkoutProduct) {
        toast.info('Selecione um produto para comprar')
        return
      }
    }
    if (tab !== 'carrinho') {
      setCheckoutProduct(null)
    }
    setActiveTab(tab)
    setShowNotifications(false)
  }

  const handleBuy = (product: Product) => {
    if (!user) {
      toast.error('Faca login para comprar')
      return
    }
    setCheckoutProduct(product)
    setActiveTab('carrinho')
  }

  const handleCheckoutBack = () => {
    setCheckoutProduct(null)
    setActiveTab('loja')
  }

  const handleOrderCreated = () => {
    fetchNotifications()
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // silent
    }
    setUser(null)
    setNotifications([])
    setActiveTab('loja')
    setCheckoutProduct(null)
    toast.success('Voce saiu da sua conta')
  }

  const handleNotificationsOpen = () => {
    setShowNotifications(!showNotifications)
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        user={user}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadCount={unreadCount}
        onNotificationsOpen={handleNotificationsOpen}
        onLogout={handleLogout}
        checkoutProduct={checkoutProduct?.id || null}
      />

      {/* Notifications Panel */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              setShowNotifications(false)
              markNotificationsRead()
            }}
          />
          <div className="fixed right-4 top-20 z-50 w-80 sm:w-96 max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col fade-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Notificacoes</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px]">{unreadCount}</Badge>
                )}
              </div>
              <button
                onClick={() => {
                  setShowNotifications(false)
                  markNotificationsRead()
                }}
                className="p-1 rounded hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificacao</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-lg transition-colors cursor-default ${
                        n.read ? 'bg-transparent' : 'bg-primary/5 border border-primary/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {unreadCount > 0 && (
              <div className="p-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs hover:bg-primary/20 hover:text-primary hover:border-primary/30"
                  onClick={markNotificationsRead}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Marcar todas como lidas
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full pb-24 md:pb-6">
        {activeTab === 'loja' && (
          <div className="fade-in">
            {/* Hero Section */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                <Key className="h-4 w-4" />
                Chaves & Ativadores
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
                Encontre sua{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">
                  chave perfeita
                </span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                Compre chaves de ativacao com entrega automatica via PIX. Rapido, seguro e confiavel.
              </p>
            </div>

            {/* Search */}
            {products.length > 0 && (
              <div className="relative max-w-md mx-auto mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border focus:border-primary"
                />
              </div>
            )}

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="bg-card overflow-hidden">
                    <Skeleton className="aspect-[16/10] w-full" />
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-9 w-24 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Search className="h-7 w-7 text-primary/50" />
                  </div>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Nenhum produto encontrado para esta busca' : 'Nenhum produto disponivel no momento'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onBuy={handleBuy}
                    inCart={checkoutProduct?.id === product.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'carrinho' && checkoutProduct && (
          <Checkout
            product={checkoutProduct}
            onBack={handleCheckoutBack}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {activeTab === 'meus-produtos' && (
          <MyProducts
            user={user}
            onLogin={() => (window.location.href = '/api/auth/discord')}
          />
        )}

        {activeTab === 'admin' && user?.isAdmin && <AdminPanel />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background/50 backdrop-blur-sm py-4 px-4 md:pb-4 pb-20 md:pb-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
              <Key className="h-3 w-3 text-primary" />
            </div>
            <span className="font-medium">MagnaKeys</span>
          </div>
          <span>Entrega automatica via PIX</span>
        </div>
      </footer>
    </div>
  )
}