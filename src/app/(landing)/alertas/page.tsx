'use client';

import Link from 'next/link';

export default function AlertasPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050508, #0a0a1a)',
      color: '#e4e4e7',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: 1.6,
    }}>
      {/* Top nav */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <Link href="/wasapea.html" style={{
          fontWeight: 800,
          fontSize: '1.1rem',
          color: '#fff',
          textDecoration: 'none',
        }}>
          WASAPEA<span style={{ color: '#a855f7' }}>PRO</span>
        </Link>
        <Link href="/login" style={{
          padding: '.45rem 1.1rem',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '.85rem',
          border: '1px solid #a855f7',
          color: '#a855f7',
          textDecoration: 'none',
        }}>Dashboard</Link>
      </nav>

      {/* Hero */}
      <section style={{
        padding: '5rem 1.5rem 3rem',
        textAlign: 'center',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '.4rem',
          background: 'rgba(168,85,247,.1)',
          border: '1px solid rgba(168,85,247,.2)',
          borderRadius: '50px',
          padding: '.35rem .85rem',
          fontSize: '.78rem',
          color: '#c4b5fd',
          marginBottom: '1.5rem',
        }}>
          📡 6 productos · Datos en tiempo real
        </div>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 800,
          letterSpacing: '-.02em',
          lineHeight: 1.15,
          marginBottom: '1.25rem',
        }}>
          Recibe <span style={{
            background: 'linear-gradient(135deg, #c4b5fd, #a855f7, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>alertas inteligentes</span> directo en tu WhatsApp
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#a1a1aa', maxWidth: 540, margin: '0 auto 2rem' }}>
          Criptomonedas, divisas, metales, TRM, licitaciones SECOP y monitoreo web. Todo automatizado. Empieza en 10 segundos.
        </p>
        <a href="#productos" style={{
          display: 'inline-block',
          padding: '.75rem 2rem',
          borderRadius: '10px',
          fontWeight: 600,
          background: '#a855f7',
          color: '#fff',
          textDecoration: 'none',
        }}>Ver productos →</a>
      </section>

      {/* Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '3rem',
        flexWrap: 'wrap',
        padding: '2rem 0 3rem',
        borderTop: '1px solid rgba(255,255,255,.05)',
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        {[{ num: '6', label: 'Productos' }, { num: '9', label: 'Workflows 24/7' }, { num: '0', label: 'Config requerida' }, { num: '10s', label: 'Para empezar' }].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7' }}>{s.num}</div>
            <div style={{ fontSize: '.8rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Products Grid */}
      <section id="productos" style={{ padding: '4rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '.5rem' }}>Nuestros Productos</h2>
          <p style={{ color: '#a1a1aa' }}>Elige los que necesites. Actívalos y desactívalos cuando quieras.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}>
          {PRODUCTS.map(p => (
            <div key={p.name} style={{
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: '16px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              transition: 'all .25s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '2rem' }}>{p.icon}</span>
                <span style={{
                  fontSize: '.7rem',
                  padding: '.2rem .6rem',
                  borderRadius: '50px',
                  fontWeight: 600,
                  background: p.tier === 'free' ? 'rgba(34,197,94,.12)' : 'rgba(168,85,247,.12)',
                  color: p.tier === 'free' ? '#4ade80' : '#a855f7',
                }}>{p.tier === 'free' ? 'GRATIS' : 'PRO'}</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{p.name}</h3>
              <p style={{ color: '#a1a1aa', fontSize: '.85rem', flex: 1 }}>{p.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                {p.tags.map(t => (
                  <span key={t} style={{
                    fontSize: '.72rem',
                    padding: '.2rem .55rem',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.06)',
                    color: '#a1a1aa',
                  }}>{t}</span>
                ))}
              </div>
              <a href={p.waLink} style={{
                textAlign: 'center',
                padding: '.5rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '.85rem',
                background: '#a855f7',
                color: '#fff',
                textDecoration: 'none',
              }}>Activar en WhatsApp →</a>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '.5rem' }}>¿Cómo funciona?</h2>
          <p style={{ color: '#a1a1aa' }}>No necesitas instalar nada. Solo WhatsApp.</p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '2rem',
        }}>
          {[
            { num: '1', title: 'Elige tus alertas', desc: 'Selecciona los productos que te interesan.' },
            { num: '2', title: 'Envía un WhatsApp', desc: 'Un solo mensaje y quedas suscrito automáticamente.' },
            { num: '3', title: 'Recibe tus datos', desc: 'Las alertas llegan directo a tu WhatsApp, sin apps.' },
            { num: '4', title: 'Adminístralas', desc: 'Activa, desactiva o configura umbrales desde /alertas.' },
          ].map(s => (
            <div key={s.num} style={{ textAlign: 'center' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(168,85,247,.1)',
                border: '1px solid rgba(168,85,247,.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#a855f7',
                marginBottom: '1rem',
              }}>{s.num}</div>
              <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '.35rem' }}>{s.title}</h4>
              <p style={{ color: '#a1a1aa', fontSize: '.82rem' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,.08), rgba(99,102,241,.06))',
          border: '1px solid rgba(168,85,247,.15)',
          borderRadius: 20,
          padding: '3rem 2rem',
          maxWidth: 640,
          margin: '0 auto',
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '.75rem' }}>¿Listo para recibir alertas inteligentes?</h2>
          <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
            Empieza en 10 segundos. Sin registros, sin apps. Solo WhatsApp.
          </p>
          <a href="https://wa.me/573106055920?text=Hola+quiero+empezar+con+Alertas+PRO" style={{
            display: 'inline-block',
            padding: '.85rem 2.5rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '1rem',
            background: '#a855f7',
            color: '#fff',
            textDecoration: 'none',
          }}>Empezar ahora →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        borderTop: '1px solid rgba(255,255,255,.05)',
        textAlign: 'center',
        color: '#52525b',
        fontSize: '.78rem',
      }}>
        <p>
          <Link href="/wasapea.html" style={{ color: '#a855f7', textDecoration: 'none' }}>WASAPEA PRO</Link> · Suite de alertas inteligentes por WhatsApp · © 2026
        </p>
      </footer>
    </div>
  )
}

const PRODUCTS = [
  {
    name: 'CryptoTrader', icon: '💰', tier: 'free',
    desc: 'Precios de Bitcoin, Ethereum y USDT en tiempo real. Actualizaciones cada 6 horas con variación 24h.',
    tags: ['BTC', 'ETH', 'USDT', '24h change'],
    waLink: 'https://wa.me/573106055920?text=Quiero+CryptoTrader',
  },
  {
    name: 'ForexAlert', icon: '💱', tier: 'free',
    desc: 'Cotizaciones de EUR, GBP, JPY, CAD, AUD frente al USD. Ideal para importadores y viajeros.',
    tags: ['EUR/USD', 'GBP/USD', 'USD/JPY', '7 pares'],
    waLink: 'https://wa.me/573106055920?text=Quiero+ForexAlert',
  },
  {
    name: 'GoldTrack', icon: '🥇', tier: 'free',
    desc: 'Precios diarios de oro, plata, platino y paladio en USD por onza. Para inversionistas en metales preciosos.',
    tags: ['XAU', 'XAG', 'XPT', 'XPD'],
    waLink: 'https://wa.me/573106055920?text=Quiero+GoldTrack',
  },
  {
    name: 'TRM Alertas', icon: '💵', tier: 'free',
    desc: 'TRM diaria Colombia + alertas cuando el dólar cruza tus umbrales configurados. Conversiones rápidas incluidas.',
    tags: ['COP/USD', 'Diaria 8am', 'Umbrales', 'Conversiones'],
    waLink: 'https://wa.me/573106055920?text=Quiero+TRM+Alertas',
  },
  {
    name: 'SECOP Alertas', icon: '📋', tier: 'pro',
    desc: 'Licitaciones públicas de Colombia filtradas por tus keywords. Recibe oportunidades de contratación directo en WhatsApp.',
    tags: ['SECOP II', 'Keywords', 'Cada 6h', '+48h'],
    waLink: 'https://wa.me/573106055920?text=Quiero+SECOP+Alertas',
  },
  {
    name: 'Vigilante Digital', icon: '🛡️', tier: 'pro',
    desc: 'Monitoreo 24/7 de tus sitios web + detección de cambios en páginas. Alertas instantáneas si algo falla o cambia.',
    tags: ['Uptime', 'Cambios', 'Instantáneo', '24/7'],
    waLink: 'https://wa.me/573106055920?text=Quiero+Vigilante+Digital',
  },
]
