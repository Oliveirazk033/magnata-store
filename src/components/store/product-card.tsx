'use client'

import { ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  availableKeys: number
}

interface ProductCardProps {
  product: Product
  onBuy: (product: Product) => void
  inCart: boolean
}

function formatPrice(price: number): string {
  return `R$ ${(price / 100).toFixed(2).replace('.', ',')}`
}

export function ProductCard({ product, onBuy, inCart }: ProductCardProps) {
  const outOfStock = product.availableKeys === 0
  const lowStock = product.availableKeys > 0 && product.availableKeys <= 3

  return (
    <Card className="card-glow group bg-card overflow-hidden flex flex-col slide-up">
      {/* Image Area */}
      <div className="relative aspect-[16/10] bg-secondary/50 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-8 w-8 text-primary/40" />
            </div>
          </div>
        )}

        {/* Stock Badge */}
        <div className="absolute top-3 left-3">
          <Badge
            variant={outOfStock ? 'destructive' : lowStock ? 'secondary' : 'default'}
            className={`text-xs font-semibold ${
              outOfStock
                ? 'bg-destructive/90 text-destructive-foreground'
                : lowStock
                ? 'bg-amber-500/90 text-white'
                : 'bg-emerald-500/90 text-white'
            }`}
          >
            {outOfStock ? 'Esgotado' : `${product.availableKeys} disponível${product.availableKeys > 1 ? 'is' : ''}`}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div>
            <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
          </div>
          <Button
            size="sm"
            disabled={outOfStock}
            onClick={() => onBuy(product)}
            className={
              inCart
                ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }
          >
            {inCart ? 'No Carrinho' : 'Comprar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}