'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Edit3, Package, KeyRound, ShoppingCart, Loader2,
  CheckCircle, XCircle, RefreshCw, Search, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface AdminProduct {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  active: boolean
  availableKeys: number
}

interface AdminKey {
  id: string
  code: string
  status: string
  product: { name: string }
  user: { displayName: string | null; discordUsername: string | null } | null
  createdAt: string
}

interface AdminOrder {
  id: string
  userName: string | null
  productName: string
  amount: number
  status: string
  payerName: string
  key: string | null
  createdAt: string
}

function formatPrice(price: number): string {
  return `R$ ${(price / 100).toFixed(2).replace('.', ',')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type AdminTab = 'products' | 'keys' | 'orders'

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('products')
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [keys, setKeys] = useState<AdminKey[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [newKeysText, setNewKeysText] = useState('')
  const [addingKeys, setAddingKeys] = useState(false)

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null)
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productImage, setProductImage] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      toast.error('Erro ao buscar produtos')
    }
  }, [])

  const fetchKeys = useCallback(async (productId?: string) => {
    try {
      const url = productId ? `/api/admin/keys?productId=${productId}` : '/api/admin/keys'
      const res = await fetch(url)
      const data = await res.json()
      setKeys(data.keys || [])
    } catch {
      toast.error('Erro ao buscar chaves')
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch {
      toast.error('Erro ao buscar pedidos')
    }
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchProducts(), fetchKeys(), fetchOrders()])
      setLoading(false)
    }
    loadAll()
  }, [fetchProducts, fetchKeys, fetchOrders])

  // Product CRUD
  const openNewProductDialog = () => {
    setEditingProduct(null)
    setProductName('')
    setProductDesc('')
    setProductPrice('')
    setProductImage('')
    setProductDialogOpen(true)
  }

  const openEditProductDialog = (product: AdminProduct) => {
    setEditingProduct(product)
    setProductName(product.name)
    setProductDesc(product.description || '')
    setProductPrice(String(product.price))
    setProductImage(product.imageUrl || '')
    setProductDialogOpen(true)
  }

  const saveProduct = async () => {
    if (!productName.trim() || !productPrice) {
      toast.error('Nome e preco sao obrigatorios')
      return
    }
    setSavingProduct(true)
    try {
      if (editingProduct) {
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProduct.id,
            name: productName.trim(),
            description: productDesc.trim() || null,
            price: Number(productPrice),
            imageUrl: productImage.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || 'Erro ao atualizar')
          return
        }
        toast.success('Produto atualizado!')
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: productName.trim(),
            description: productDesc.trim() || null,
            price: Number(productPrice),
            imageUrl: productImage.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || 'Erro ao criar')
          return
        }
        toast.success('Produto criado!')
      }
      setProductDialogOpen(false)
      fetchProducts()
    } catch {
      toast.error('Erro de conexao')
    } finally {
      setSavingProduct(false)
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto e todas suas chaves?')) return
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao deletar')
        return
      }
      toast.success('Produto deletado!')
      fetchProducts()
      fetchKeys()
    } catch {
      toast.error('Erro de conexao')
    }
  }

  // Keys
  const addKeys = async () => {
    if (!selectedProductId) {
      toast.error('Selecione um produto')
      return
    }
    const codes = newKeysText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (codes.length === 0) {
      toast.error('Digite pelo menos uma chave')
      return
    }
    setAddingKeys(true)
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, codes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao adicionar chaves')
        return
      }
      toast.success(`${data.created} chaves adicionadas!`)
      setNewKeysText('')
      fetchKeys(selectedProductId)
      fetchProducts()
    } catch {
      toast.error('Erro de conexao')
    } finally {
      setAddingKeys(false)
    }
  }

  const deleteKey = async (id: string) => {
    try {
      await fetch(`/api/admin/keys?id=${id}`, { method: 'DELETE' })
      toast.success('Chave deletada')
      fetchKeys(selectedProductId || undefined)
      fetchProducts()
    } catch {
      toast.error('Erro ao deletar')
    }
  }

  // Orders
  const handleOrderAction = async (orderId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao processar')
        return
      }
      toast.success(action === 'approve' ? 'Pedido aprovado!' : 'Pedido recusado')
      fetchOrders()
    } catch {
      toast.error('Erro de conexao')
    }
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'products', label: 'Produtos', icon: <Package className="h-4 w-4" /> },
    { key: 'keys', label: 'Chaves', icon: <KeyRound className="h-4 w-4" /> },
    { key: 'orders', label: 'Pedidos', icon: <ShoppingCart className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Painel Administrativo</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie produtos, chaves e pedidos</p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-secondary/50 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={openNewProductDialog}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          placeholder="Ex: Windows 11 Pro"
                          className="bg-secondary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descricao</Label>
                        <Textarea
                          value={productDesc}
                          onChange={(e) => setProductDesc(e.target.value)}
                          placeholder="Descricao do produto..."
                          className="bg-secondary/50 min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preco (centavos)</Label>
                        <Input
                          type="number"
                          value={productPrice}
                          onChange={(e) => setProductPrice(e.target.value)}
                          placeholder="Ex: 4990 para R$ 49,90"
                          className="bg-secondary/50"
                        />
                        {productPrice && (
                          <p className="text-xs text-muted-foreground">
                            = {formatPrice(Number(productPrice))}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>URL da Imagem (opcional)</Label>
                        <Input
                          value={productImage}
                          onChange={(e) => setProductImage(e.target.value)}
                          placeholder="https://..."
                          className="bg-secondary/50"
                        />
                      </div>
                      <Button
                        onClick={saveProduct}
                        disabled={savingProduct}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {savingProduct ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                        ) : editingProduct ? (
                          'Salvar Alteracoes'
                        ) : (
                          'Criar Produto'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {products.length === 0 ? (
                <Card className="bg-card">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground text-sm">Nenhum produto cadastrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {products.map((p) => (
                    <Card key={p.id} className="card-glow bg-card">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Package className="h-6 w-6 text-primary/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{p.name}</p>
                              <Badge
                                variant={p.active ? 'default' : 'secondary'}
                                className={
                                  p.active
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]'
                                    : 'text-[10px]'
                                }
                              >
                                {p.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatPrice(p.price)} &middot; {p.availableKeys} chaves disponiveis
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditProductDialog(p)}
                              className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteProduct(p.id)}
                              className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Keys Tab */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              {/* Add Keys */}
              <Card className="card-glow bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Adicionar Chaves</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={newKeysText}
                    onChange={(e) => setNewKeysText(e.target.value)}
                    placeholder="Cole as chaves aqui, uma por linha..."
                    className="bg-secondary/50 min-h-[120px] font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {newKeysText.split('\n').filter((l) => l.trim()).length} chave(s)
                    </span>
                    <Button
                      onClick={addKeys}
                      disabled={addingKeys || !selectedProductId || !newKeysText.trim()}
                      size="sm"
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {addingKeys ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Adicionando...</>
                      ) : (
                        <><Plus className="h-4 w-4" /> Adicionar</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Keys List */}
              <Card className="bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Chaves ({keys.length})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchKeys(selectedProductId || undefined)}
                      className="gap-1 hover:bg-primary/20 hover:text-primary hover:border-primary/30"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin space-y-2">
                    {keys.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma chave encontrada
                      </p>
                    ) : (
                      keys.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                        >
                          <Badge
                            variant="secondary"
                            className={
                              k.status === 'available'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0'
                                : k.status === 'sold'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] shrink-0'
                                : 'text-[10px] shrink-0'
                            }
                          >
                            {k.status === 'available' ? 'Disponivel' : k.status === 'sold' ? 'Vendida' : k.status}
                          </Badge>
                          <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                            {k.code}
                          </code>
                          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                            {k.product.name}
                          </span>
                          {k.status === 'available' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteKey(k.id)}
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{orders.length} pedidos</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOrders}
                  className="gap-1 hover:bg-primary/20 hover:text-primary hover:border-primary/30"
                >
                  <RefreshCw className="h-3 w-3" /> Atualizar
                </Button>
              </div>

              {orders.length === 0 ? (
                <Card className="bg-card">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground text-sm">Nenhum pedido encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto scrollbar-thin space-y-2">
                  {orders.map((o) => (
                    <Card key={o.id} className="card-glow bg-card">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              #{o.id.slice(-6)} - {o.productName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {o.userName || 'Desconhecido'} &middot; {formatDate(o.createdAt)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              o.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0'
                                : o.status === 'cancelled'
                                ? 'bg-destructive/20 text-destructive border-destructive/30 shrink-0'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0'
                            }
                          >
                            {o.status === 'approved'
                              ? 'Aprovado'
                              : o.status === 'cancelled'
                              ? 'Cancelado'
                              : 'Pendente'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Titular: <span className="text-foreground">{o.payerName || '-'}</span>
                          </span>
                          <span className="font-medium">{formatPrice(o.amount)}</span>
                        </div>
                        {o.key && (
                          <div className="bg-secondary/50 rounded p-2">
                            <code className="text-xs font-mono text-muted-foreground break-all">{o.key}</code>
                          </div>
                        )}
                        {(o.status === 'pending' || o.status === 'paid') && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleOrderAction(o.id, 'approve')}
                              className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOrderAction(o.id, 'reject')}
                              className="flex-1 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Recusar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}