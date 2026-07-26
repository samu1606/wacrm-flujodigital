'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Bell, Check } from 'lucide-react'

type Product = 'cryptotrader' | 'forexalert' | 'goldtrack' | 'secop' | 'trm' | 'vigilante'
type Plan = 'free' | 'pro' | 'trader' | 'investor' | 'empresarial'

interface Subscription {
  phone: string
  product: Product
  plan: Plan
  active: boolean
  config: Record<string, any>
}

const PRODUCTS: { key: Product; name: string; emoji: string; desc: string; color: string }[] = [
  { key: 'cryptotrader', name: 'CryptoTrader', emoji: '💰', desc: 'BTC, ETH, USDT en WhatsApp', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'forexalert', name: 'ForexAlert', emoji: '💱', desc: '170 divisas mundiales', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'goldtrack', name: 'GoldTrack', emoji: '🥇', desc: 'Oro, plata, platino, paladio', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { key: 'secop', name: 'SECOP Alertas', emoji: '📋', desc: 'Licitaciones públicas Colombia', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { key: 'trm', name: 'TRM Alertas', emoji: '💵', desc: 'Tasa de cambio COP/USD', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { key: 'vigilante', name: 'Vigilante Digital', emoji: '🛡️', desc: 'Monitoreo web + detección de cambios', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
]

export default function AlertasPage() {
  const { profile } = useAuth()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [phone, setPhone] = useState('')

  const fetchSubs = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    try {
      const res = await fetch(`/api/alertas?phone=${phone}`)
      const data = await res.json()
      if (data.subscriptions) setSubs(data.subscriptions)
    } catch (e) {
      // table might not exist yet
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => {
    if (profile?.email) {
      // Use stored phone or prompt
      const stored = subs[0]?.phone
      if (stored) setPhone(stored)
      else fetchSubs()
    }
  }, [profile])

  useEffect(() => {
    if (phone) fetchSubs()
  }, [phone])

  const toggleProduct = async (product: Product, active: boolean) => {
    setSaving(product)
    try {
      const existing = subs.find(s => s.product === product)
      if (existing) {
        await fetch(`/api/alertas?phone=${phone}&product=${product}`, { method: 'DELETE' })
        setSubs(prev => prev.filter(s => s.product !== product))
      } else {
        const res = await fetch('/api/alertas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, product, plan: 'free', active: true, config: {} }),
        })
        const data = await res.json()
        if (data.subscription) {
          setSubs(prev => [...prev.filter(s => s.product !== product), data.subscription])
        }
      }
    } catch (e) {
      console.error('Toggle failed:', e)
    } finally {
      setSaving(null)
    }
  }

  const updateConfig = async (product: Product, config: Record<string, any>) => {
    setSaving(product)
    try {
      const existing = subs.find(s => s.product === product)
      await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          product,
          plan: existing?.plan || 'free',
          active: existing?.active !== false,
          config,
        }),
      })
      setSubs(prev => prev.map(s =>
        s.product === product ? { ...s, config } : s
      ))
    } catch (e) {
      console.error('Config update failed:', e)
    } finally {
      setSaving(null)
    }
  }

  const getSub = (product: Product) => subs.find(s => s.product === product)
  const isActive = (product: Product) => {
    const s = getSub(product)
    return s ? s.active : false
  }

  const activeCount = subs.filter(s => s.active).length

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Mis Alertas</h1>
        </div>
        <p className="text-muted-foreground">
          Activa las alertas que quieres recibir en WhatsApp.
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCount} activa{activeCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </p>
      </div>

      {/* Phone input */}
      <Card className="p-4">
        <Label htmlFor="phone">Tu número de WhatsApp</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="phone"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="573001234567"
            className="max-w-xs font-mono"
          />
          <Button variant="outline" onClick={fetchSubs} disabled={!phone || phone.length < 10}>
            Cargar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Código de país + número. Ej: 573001234567
        </p>
      </Card>

      {/* Products */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map(p => {
            const sub = getSub(p.key)
            const active = !!sub?.active
            const isSaving = saving === p.key

            return (
              <Card
                key={p.key}
                className={`p-5 border transition-colors ${active ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                  {isSaving ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={active}
                      onCheckedChange={v => toggleProduct(p.key, v)}
                    />
                  )}
                </div>

                {active && sub && (
                  <ConfigPanel
                    product={p.key}
                    config={sub.config || {}}
                    onSave={config => updateConfig(p.key, config)}
                    saving={isSaving}
                  />
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ConfigPanel({ product, config, onSave, saving }: {
  product: Product
  config: Record<string, any>
  onSave: (config: Record<string, any>) => void
  saving: boolean
}) {
  const [local, setLocal] = useState(config)

  if (product === 'trm') {
    return (
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs">Umbrales de alerta (COP)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Bajo (ej: 3100)"
            value={local.umbral_bajo || ''}
            onChange={e => setLocal({ ...local, umbral_bajo: e.target.value })}
            className="h-8 text-xs"
          />
          <Input
            type="number"
            placeholder="Alto (ej: 3300)"
            value={local.umbral_alto || ''}
            onChange={e => setLocal({ ...local, umbral_alto: e.target.value })}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onSave(local)} disabled={saving}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (product === 'secop') {
    return (
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs">Keywords (separadas por coma)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="eléctrico, solar, panel, transformador"
            value={(local.keywords || []).join(', ')}
            onChange={e => setLocal({ ...local, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onSave(local)} disabled={saving}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
