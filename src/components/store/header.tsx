'use client'

import { useState, useEffect, useRef } from 'react'
import { Key, ShoppingCart, Package, Shield, Bell, LogOut, Menu, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface User {
  id: string
  discordId: string
  discordUsername: string | null
  discordAvatar: string | null
  displayName: string | null
  isAdmin: boolean
}

export type Tab = 'loja' | 'carrinho' | 'meus-produtos' | 'admin'

interface HeaderProps {
  user: User | null
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  unreadCount: number
  onNotificationsOpen: () => void
  onLogout: () => void
  checkoutProduct: string | null
}

const navItems: { tab: Tab; label: string; icon: React.ReactNode; requireAuth?: boolean; adminOnly?: boolean }[] = [
  { tab: 'loja', label: 'Loja', icon: <Key className="h-4 w-4" /> },
  { tab: 'carrinho', label: 'Carrinho', icon: <ShoppingCart className="h-4 w-4" />, requireAuth: true },
  { tab: 'meus-produtos', label: 'Meus Produtos', icon: <Package className="h-4 w-4" />, requireAuth: true },
  { tab: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" />, adminOnly: true },
]

export function Header({
  user,
  activeTab,
  onTabChange,
  unreadCount,
  onNotificationsOpen,
  onLogout,
  checkoutProduct,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const notifRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !user?.isAdmin) return false
    return true
  })

  const handleTabClick = (tab: Tab) => {
    if (tab !== 'loja' && tab !== 'carrinho' && !user) return
    onTabChange(tab)
    setMobileMenuOpen(false)
  }

  return (
    <>
      {/* Desktop Header */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-md border-border'
            : 'bg-background/80 backdrop-blur-sm border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onTabChange('loja')}
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Key className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block">MagnaKeys</span>
          </button>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNavItems.map((item) => {
              const isCartWithProduct = item.tab === 'carrinho' && !!checkoutProduct
              const isActive = activeTab === item.tab || isCartWithProduct
              return (
                <button
                  key={item.tab}
                  onClick={() => handleTabClick(item.tab)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.tab === 'carrinho' && checkoutProduct && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                      1
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                ref={notifRef}
                onClick={onNotificationsOpen}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center pulse-violet">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.discordAvatar || undefined} alt={user.displayName || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                        {(user.displayName || user.discordUsername || 'U').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">
                      {user.displayName || user.discordUsername}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.displayName || user.discordUsername}</p>
                    <p className="text-xs text-muted-foreground">#{user.discordUsername}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleTabClick('meus-produtos')}>
                    <Package className="mr-2 h-4 w-4" />
                    Meus Produtos
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem onClick={() => handleTabClick('admin')}>
                      <Shield className="mr-2 h-4 w-4" />
                      Painel Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => (window.location.href = '/api/auth/discord')}
                size="sm"
                className="gap-2 bg-violet-600 hover:bg-violet-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                </svg>
                <span className="hidden sm:inline">Entrar com Discord</span>
              </Button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md fade-in">
            <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
              {visibleNavItems.map((item) => {
                const isCartWithProduct = item.tab === 'carrinho' && !!checkoutProduct
                const isActive = activeTab === item.tab || isCartWithProduct
                return (
                  <button
                    key={item.tab}
                    onClick={() => handleTabClick(item.tab)}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                    {item.tab === 'carrinho' && checkoutProduct && (
                      <Badge className="ml-auto h-5 px-1.5 text-[10px]">1</Badge>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around h-16 px-2">
          {visibleNavItems.map((item) => {
            const isCartWithProduct = item.tab === 'carrinho' && !!checkoutProduct
            const isActive = activeTab === item.tab || isCartWithProduct
            return (
              <button
                key={item.tab}
                onClick={() => handleTabClick(item.tab)}
                className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.tab === 'carrinho' && checkoutProduct && (
                    <span className="absolute -top-1.5 -right-2 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                      1
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}