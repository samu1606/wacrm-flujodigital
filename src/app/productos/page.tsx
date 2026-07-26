/**
 * /productos — Marketplace público de Alertas PRO (HTTPS vía wasapeapro.com)
 */
export default function ProductosPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050508, #0a0a1a)',
      color: '#e4e4e7',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: 1.6,
    }}>
      {/* Hero */}
      <section style={{
        padding: '6rem 1.5rem 4rem',
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
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#productos" style={{
            padding: '.75rem 2rem',
            borderRadius: '10px',
            fontWeight: 600,
            background: '#a855f7',
            color: '#fff',
            textDecoration: 'none',
            transition: 'all .2s',
          }}>Ver productos →</a>
          <a href="#planes" style={{
            padding: '.75rem 2rem',
            borderRadius: '10px',
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,.15)',
            color: '#d4d4d8',
            textDecoration: 'none',
            transition: 'all .2s',
          }}>Ver planes</a>
          <a href="/login" style={{
            padding: '.75rem 1.5rem',
            borderRadius: '10px',
            fontWeight: 600,
            border: '1px solid #a855f7',
            color: '#a855f7',
            textDecoration: 'none',
            transition: 'all .2s',
          }}>Dashboard</a>
        </div>
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
              <div style={{ display: 'flex', gap: '.5rem', paddingTop: '.5rem', borderTop: '1px solid rgba(255,255,255,.04)' }}>
                <a href={p.waLink} style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '.5rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '.85rem',
                  background: '#a855f7',
                  color: '#fff',
                  textDecoration: 'none',
                }}>Empezar</a>
                <a href={p.landing} style={{
                  padding: '.5rem .75rem',
                  borderRadius: '8px',
                  border: '1px solid #a855f7',
                  color: '#a855f7',
                  textDecoration: 'none',
                  fontSize: '.85rem',
                }}>🌐</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section id="planes" style={{ padding: '4rem 1.5rem', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '.5rem' }}>Planes y Precios</h2>
          <p style={{ color: '#a1a1aa' }}>Empieza gratis. Escala cuando necesites más.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
        }}>
          {[
            { name: '🚀 Starter', price: '$0', period: '/mes', features: ['3 productos simultáneos', '1 actualización diaria', 'Entrega por WhatsApp'] },
            { name: '⚡ Pro', price: '$9', period: '/mes', features: ['Todos los productos (6)', 'Cada 6 horas', 'Umbrales personalizados', 'Keywords en SECOP', 'Alertas instantáneas'], popular: true },
            { name: '🏆 Empresarial', price: '$19', period: '/mes', features: ['Todo lo de Pro', 'Hasta 5 números WhatsApp', 'Dashboard analytics', 'Exportación CSV', 'Soporte prioritario'] },
          ].map(p => (
            <div key={p.name} style={{
              background: 'rgba(255,255,255,.02)',
              border: p.popular ? '1px solid rgba(168,85,247,.4)' : '1px solid rgba(255,255,255,.06)',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center',
              position: 'relative',
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#a855f7',
                  color: '#fff',
                  fontSize: '.7rem',
                  padding: '.2rem .8rem',
                  borderRadius: '50px',
                  fontWeight: 600,
                }}>Más popular</div>
              )}
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '.5rem' }}>{p.name}</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '1rem 0 .25rem' }}>
                {p.price}<small style={{ fontSize: '.85rem', fontWeight: 400, color: '#71717a' }}>{p.period}</small>
              </div>
              <ul style={{ listStyle: 'none', textAlign: 'left', marginBottom: '1.5rem', padding: 0 }}>
                {p.features.map(f => (
                  <li key={f} style={{
                    padding: '.5rem 0',
                    fontSize: '.85rem',
                    color: '#d4d4d8',
                    borderBottom: '1px solid rgba(255,255,255,.03)',
                  }}>
                    <span style={{ color: '#4ade80', fontWeight: 700, marginRight: '.5rem' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://wa.me/573106055920?text=Quiero+info+del+plan" style={{
                display: 'block',
                width: '100%',
                padding: '.85rem',
                borderRadius: '10px',
                fontWeight: 700,
                background: p.popular ? '#a855f7' : 'transparent',
                border: p.popular ? 'none' : '1px solid rgba(255,255,255,.15)',
                color: p.popular ? '#fff' : '#d4d4d8',
                textDecoration: 'none',
                textAlign: 'center',
              }}>{p.popular ? 'Elegir Pro' : 'Empezar gratis'}</a>
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
            { num: '4', title: 'Administra cuando quieras', desc: 'Activa, desactiva o configura umbrales desde tu panel.' },
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
        <p>Alertas PRO · Suite de alertas inteligentes por WhatsApp · © 2026</p>
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
    landing: 'https://cryptotrader.148-230-90-171.nip.io',
  },
  {
    name: 'ForexAlert', icon: '💱', tier: 'free',
    desc: 'Cotizaciones de EUR, GBP, JPY, CAD, AUD frente al USD. Ideal para importadores y viajeros.',
    tags: ['EUR/USD', 'GBP/USD', 'USD/JPY', '7 pares'],
    waLink: 'https://wa.me/573106055920?text=Quiero+ForexAlert',
    landing: 'https://forexalert.148-230-90-171.nip.io',
  },
  {
    name: 'GoldTrack', icon: '🥇', tier: 'free',
    desc: 'Precios diarios de oro, plata, platino y paladio en USD por onza. Para inversionistas en metales preciosos.',
    tags: ['XAU', 'XAG', 'XPT', 'XPD'],
    waLink: 'https://wa.me/573106055920?text=Quiero+GoldTrack',
    landing: 'https://goldtrack.148-230-90-171.nip.io',
  },
  {
    name: 'TRM Alertas', icon: '💵', tier: 'free',
    desc: 'TRM diaria Colombia + alertas cuando el dólar cruza tus umbrales configurados. Conversiones rápidas incluidas.',
    tags: ['COP/USD', 'Diaria 8am', 'Umbrales', 'Conversiones'],
    waLink: 'https://wa.me/573106055920?text=Quiero+TRM+Alertas',
    landing: 'https://trm.148-230-90-171.nip.io',
  },
  {
    name: 'SECOP Alertas', icon: '📋', tier: 'pro',
    desc: 'Licitaciones públicas de Colombia filtradas por tus keywords. Recibe oportunidades de contratación directo en WhatsApp.',
    tags: ['SECOP II', 'Keywords', 'Cada 6h', '+48h'],
    waLink: 'https://wa.me/573106055920?text=Quiero+SECOP+Alertas',
    landing: 'https://secop.148-230-90-171.nip.io',
  },
  {
    name: 'Vigilante Digital', icon: '🛡️', tier: 'pro',
    desc: 'Monitoreo 24/7 de tus sitios web + detección de cambios en páginas. Alertas instantáneas si algo falla o cambia.',
    tags: ['Uptime', 'Cambios', 'Instantáneo', '24/7'],
    waLink: 'https://wa.me/573106055920?text=Quiero+Vigilante+Digital',
    landing: 'https://vigilante.148-230-90-171.nip.io',
  },
]
