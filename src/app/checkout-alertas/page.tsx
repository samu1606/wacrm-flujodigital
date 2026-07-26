'use client'

import { useState } from 'react'

export default function CheckoutAlertasPage() {
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState('pro')
  const [loading, setLoading] = useState(false)
  const [wompiData, setWompiData] = useState<any>(null)
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    if (!phone || phone.length < 10) {
      setError('Ingresa un número de WhatsApp válido (57 + número)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wompi/checkout-alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, plan }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setWompiData(data)
      }
    } catch (e) {
      setError('Error al conectar con Wompi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f, #1a0a2e)',
      fontFamily: 'system-ui, sans-serif',
      color: '#e4e4e7',
      padding: '1rem',
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(168,85,247,.2)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>⚡</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Upgrade Alertas PRO</h1>
          <p style={{ color: '#a1a1aa', fontSize: '.9rem', marginTop: '.5rem' }}>
            Activa todas las alertas ilimitadas y umbrales personalizados
          </p>
        </div>

        {!wompiData ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, marginBottom: '.35rem', color: '#a1a1aa' }}>
                Tu WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="573001234567"
                style={{
                  width: '100%',
                  padding: '.75rem 1rem',
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: '10px',
                  color: '#e4e4e7',
                  fontSize: '1rem',
                  outline: 'none',
                }}
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
                  <button
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    style={{
                      flex: 1,
                      padding: '.75rem',
                      background: plan === p.key ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${plan === p.key ? 'rgba(168,85,247,.4)' : 'rgba(255,255,255,.08)'}`,
                      borderRadius: '10px',
                      color: plan === p.key ? '#c4b5fd' : '#a1a1aa',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .2s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{p.name}</div>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#a855f7', margin: '.2rem 0' }}>{p.price}</div>
                    <div style={{ fontSize: '.7rem', color: '#71717a' }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{
                width: '100%',
                padding: '.85rem',
                background: loading ? 'rgba(168,85,247,.3)' : '#a855f7',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all .2s',
              }}
            >
              {loading ? 'Conectando...' : `Pagar con Wompi →`}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💳</div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '.5rem' }}>
              {wompiData.planName}
            </h2>
            <p style={{ color: '#a855f7', fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              ${(wompiData.amount / 100).toLocaleString('es-CO')} COP
            </p>
            <p style={{ color: '#a1a1aa', fontSize: '.8rem', marginBottom: '2rem' }}>
              Serás redirigido a Wompi para completar el pago.
              Al confirmar, tu plan se activa automáticamente.
            </p>

            {/* Wompi Button */}
            <form
              action="https://checkout.wompi.co/p/"
              method="GET"
              target="_blank"
            >
              <input type="hidden" name="public-key" value={wompiData.wompiPublicKey} />
              <input type="hidden" name="currency" value="COP" />
              <input type="hidden" name="amount-in-cents" value={wompiData.amount} />
              <input type="hidden" name="reference" value={wompiData.reference} />
              {wompiData.integrity && <input type="hidden" name="signature:integrity" value={wompiData.integrity} />}
              <input type="hidden" name="redirect-url" value={`http://148.230.90.171:8095/checkout-alertas?paid=true&phone=${wompiData.phone}`} />
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: '#a855f7',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                }}
              >
                Ir a Wompi para pagar →
              </button>
            </form>

            <button
              onClick={() => setWompiData(null)}
              style={{
                marginTop: '1rem',
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                fontSize: '.8rem',
                textDecoration: 'underline',
              }}
            >
              Cambiar plan o número
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
