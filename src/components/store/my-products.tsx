'use client'

import { useState, useEffect, useCallback } from 'react'
import { LogIn, RefreshCw, Copy, Check, Package, Clock, CheckCircle, XCircle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export interface User {
  id: string
  discordId: string
  discordUsername: string | null
  discordAvatar: string | null
  displayName: string | null
  isAdmin: boolean
}

interface OrderItem {
  id: string
  productName: string
  amount: number
  status: string
  payerName: string
  key: string | null
  createdAt: string
}

interface MyProductsProps {
  user: User | null
  onLogin: () => void
}

function formatPrice(price: number): string {
  return `R$ ${(price / 100).toFixed(2).replace('.', ',')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle className="h-3 w-3" /> Aprovado
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
          <Clock className="h-3 w-3" /> Pendente
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
          <XCircle className="h-3 w-3" /> Cancelado
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function MyProducts({ user, onLogin }: MyProductsProps) {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders')
      if (res.status === 401) {
        setOrders([])
        return
      }
      const data = await res.json()
      setOrders(data.orders || [])
    } catch {
      toast.error('Erro ao buscar pedidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchOrders()
    } else {
      setLoading(false)
    }
  }, [user, fetchOrders])

  const copyKey = async (key: string, orderId: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedId(orderId)
      toast.success('Chave copiada!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-16 fade-in">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <LogIn className="h-8 w-8 text-primary/60" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Faca login para ver seus produtos</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Entre com sua conta Discord para acompanhar seus pedidos e ver suas chaves.
        </p>
        <Button onClick={onLogin} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
          </svg>
          Entrar com Discord
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Meus Produtos</h2>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe seus pedidos e chaves</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={loading}
          className="gap-2 hover:bg-primary/20 hover:text-primary hover:border-primary/30"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-32 mt-3" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="h-7 w-7 text-primary/50" />
            </div>
            <p className="text-muted-foreground text-sm">Voce ainda nao tem nenhum pedido</p>
            <p className="text-muted-foreground text-xs mt-1">Visite a loja para comprar chaves e ativadores</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="card-glow bg-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium text-sm truncate">{order.productName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      #{order.id.slice(-6)} &middot; {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">{formatPrice(order.amount)}</span>
                </div>

                {order.key && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-400 mb-1.5 font-medium">Sua chave:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-emerald-300 bg-emerald-500/5 rounded px-3 py-2 break-all">
                        {order.key}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyKey(order.key!, order.id)}
                        className="shrink-0 h-9 w-9 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                      >
                        {copiedId === order.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {order.status === 'pending' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-300/80">
                      Aguardando confirmacao do pagamento via PIX. A chave sera liberada automaticamente.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}