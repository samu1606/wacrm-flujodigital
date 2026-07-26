'use client'

import { useState, useEffect } from 'react'

declare global {
  interface Window {
    WidgetCheckout?: new (config: any) => any
  }
}

export default function CheckoutAlertasPage() {
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState('pro')
  const [loading, setLoading] = useState(false)
  const [widgetReady, setWidgetReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Load Wompi widget.js
  useEffect(() => {
    if (document.querySelector('script[src*="checkout.wompi.co"]')) {
      setWidgetReady(true)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://checkout.wompi.co/widget.js'
    s.onload = () => setWidgetReady(true)
    s.onerror = () => setError('No se pudo cargar el checkout de Wompi')
    document.head.appendChild(s)
  }, [])

  const handleCheckout = async () => {
    if (!phone || phone.length < 10) {
      setError('Ingresa un WhatsApp válido (57 + número)')
      return
    }
    if (!widgetReady) {
      setError('Esperando checkout de Wompi...')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Get checkout data from our API
      const res = await fetch('/api/wompi/checkout-alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, plan }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.detail || data.error)
        setLoading(false)
        return
      }

      // Open Wompi widget
      if (!window.WidgetCheckout) {
        setError('Widget de Wompi no cargado. Recarga la página.')
        setLoading(false)
        return
      }
      const checkout = new window.WidgetCheckout({
        currency: 'COP',
        amountInCents: plan === 'pro' ? 38_000_00 : 80_000_00,
        reference: data.reference,
        publicKey: data.publicKey,
        signature: { integrity: data.signatureIntegrity },
        customerData: {
          phoneNumber: phone,
          phoneNumberPrefix: '+57',
        },
      })

      console.log('[wompi-alertas] Opening widget with:', { currency: 'COP', amountInCents: plan === 'pro' ? 38_000_00 : 80_000_00, reference: data.reference, publicKey: data.publicKey?.slice(0,15)+'...' })
      try {
        checkout.open((result: any) => {
        const tx = result?.transaction
        console.log('[wompi-alertas] result:', result)

        if (tx?.status === 'APPROVED') {
          setDone(true)
        } else if (result?.error) {
          setError(result.error?.reason || 'Pago rechazado')
        }
        setLoading(false)
        });
      } catch (openErr: any) {
        console.error('[wompi-alertas] open error:', openErr)
        setError('Error al abrir modal Wompi')
        setLoading(false)
        return
      }
    } catch (err: any) {
      console.error('[wompi-alertas] error:', err?.message || err)
      setError(typeof err === 'string' ? err : err?.message || err?.type || JSON.stringify(err))
      setLoading(false)
    }
  }

  const getAmount = (p: string) => p === 'pro' ? 38000 : 80000

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0f, #1a0a2e)', fontFamily: 'system-ui, sans-serif',
        color: '#e4e4e7', padding: '1rem',
      }}>
        <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '.5rem' }}>¡Pago exitoso!</h1>
          <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
            Tu plan se activará automáticamente. Recibirás confirmación por WhatsApp.
          </p>
          <button onClick={() => { setDone(false); setPhone('') }}
            style={{ padding: '.75rem 2rem', background: '#a855f7', border: 'none', borderRadius: '10px',
              color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
            Hacer otro pago
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f, #1a0a2e)', fontFamily: 'system-ui, sans-serif',
      color: '#e4e4e7', padding: '1rem',
    }}>
      <div style={{
        maxWidth: '460px', width: '100%', background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(168,85,247,.2)', borderRadius: '20px', padding: '2.5rem 2rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>⚡</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Upgrade Alertas PRO</h1>
          <p style={{ color: '#a1a1aa', fontSize: '.9rem', marginTop: '.5rem' }}>
            Activa todas las alertas ilimitadas y umbrales personalizados
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.35rem', color: '#a1a1aa' }}>
            Tu WhatsApp
          </label>
          <input type="tel" value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="573001234567"
            style={{ width: '100%', padding: '.75rem 1rem', background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', color: '#e4e4e7',
              fontSize: '1rem', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.35rem', color: '#a1a1aa' }}>
            Plan
          </label>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            {[
              { key: 'pro', name: 'Pro', price: '$38,000 COP', desc: '6 productos + umbrales' },
              { key: 'empresarial', name: 'Empresarial', price: '$80,000 COP', desc: 'Multi-número + analytics' },
            ].map(p => (
              <button key={p.key} onClick={() => setPlan(p.key)}
                style={{ flex: 1, padding: '.75rem',
                  background: plan === p.key ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${plan === p.key ? 'rgba(168,85,247,.4)' : 'rgba(255,255,255,.08)'}`,
                  borderRadius: '10px', color: plan === p.key ? '#c4b5fd' : '#a1a1aa',
                  cursor: 'pointer', textAlign: 'center', transition: 'all .2s' }}>
                <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{p.name}</div>
                <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#a855f7', margin: '.2rem 0' }}>{p.price}</div>
                <div style={{ fontSize: '.7rem', color: '#71717a' }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>
        )}

        <button onClick={handleCheckout} disabled={loading}
          style={{ width: '100%', padding: '.85rem',
            background: loading ? 'rgba(168,85,247,.3)' : '#a855f7', border: 'none',
            borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '1rem',
            cursor: loading ? 'wait' : 'pointer', transition: 'all .2s' }}>
          {loading ? 'Abriendo Wompi...' : `Pagar ${getAmount(plan).toLocaleString('es-CO')} COP →`}
        </button>
      </div>
    </div>
  )
}
