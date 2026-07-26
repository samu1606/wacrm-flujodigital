'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const PRODUCTS: Record<string, { name: string; emoji: string; price: string; desc: string }> = {
  cryptotrader: { name: 'CryptoTrader', emoji: '💰', price: '$9.000 COP', desc: 'BTC, ETH, USDT cada 6h' },
  forexalert: { name: 'ForexAlert', emoji: '💱', price: '$9.000 COP', desc: '7 pares de divisas' },
  goldtrack: { name: 'GoldTrack', emoji: '🥇', price: '$9.000 COP', desc: 'Metales preciosos diario' },
  trm: { name: 'TRM Alertas', emoji: '💵', price: '$9.000 COP', desc: 'TRM Colombia + umbrales' },
  secop: { name: 'SECOP Alertas', emoji: '📋', price: '$9.000 COP', desc: 'Licitaciones filtradas' },
  vigilante: { name: 'Vigilante Digital', emoji: '🛡️', price: '$9.000 COP', desc: 'Monitoreo web 24/7' },
  pro: { name: 'Plan PRO', emoji: '⭐', price: '$29.000 COP', desc: 'Todos los productos + soporte prioritario' },
};

function PagarForm() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get('producto') || '';
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const body = {
      phone: form.get('phone') as string,
      product: form.get('product') as string,
      amount: form.get('amount') as string,
    };

    try {
      const res = await fetch('/api/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al enviar');
      }
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={styles.title}>¡Comprobante enviado!</h1>
          <p style={styles.subtitle}>
            Revisaremos tu pago en las próximas horas y activaremos tu suscripción.
            Recibirás una confirmación por WhatsApp.
          </p>
          <a href="https://wa.me/573106055920" style={styles.whatsappBtn}>
            💬 Escribir por WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // Nequi number for QR
  const nequiNumber = '3173662752';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Activar Alertas PRO</h1>
        <p style={styles.subtitle}>
          Paga por Nequi y envía el comprobante. Activación en menos de 24h.
        </p>

        {/* Nequi QR */}
        <div style={styles.qrSection}>
          <p style={styles.qrLabel}>Escanea con Nequi:</p>
          <div style={styles.qrBox}>
            <QRCodeSVG
              value={`nequi://payment?phone=57${nequiNumber}`}
              size={180}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
          <p style={styles.qrNumber}>
            O transfiere a: <strong>+57 {nequiNumber}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Producto</label>
            <select name="product" required defaultValue={preselected} style={styles.select}>
              <option value="">Selecciona un producto...</option>
              {Object.entries(PRODUCTS).map(([key, p]) => (
                <option key={key} value={key}>{p.emoji} {p.name} — {p.price}</option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Tu número de WhatsApp *</label>
            <input
              name="phone"
              type="tel"
              required
              placeholder="573001234567"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Valor pagado</label>
            <input
              name="amount"
              type="text"
              placeholder="$9.000"
              style={styles.input}
            />
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 14, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? '⏳ Enviando...' : '📤 Enviar Comprobante'}
          </button>
        </form>

        <p style={styles.footer}>
          ¿Ya pagaste? Envía el comprobante directo al{' '}
          <a href="https://wa.me/573106055920" style={{ color: '#a855f7' }}>WhatsApp de Alertas PRO</a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #050508, #0a0a1a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    maxWidth: 440,
    width: '100%',
    textAlign: 'center' as const,
    color: '#e4e4e7',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    marginBottom: '.5rem',
    letterSpacing: '-.02em',
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: '.9rem',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  qrSection: {
    marginBottom: '1.5rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,.06)',
  },
  qrLabel: {
    color: '#a1a1aa',
    fontSize: '.8rem',
    marginBottom: '.75rem',
  },
  qrBox: {
    background: '#fff',
    padding: 12,
    borderRadius: 12,
    display: 'inline-block',
    marginBottom: '.75rem',
  },
  qrNumber: {
    fontSize: '.85rem',
    color: '#d4d4d8',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    textAlign: 'left' as const,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '.35rem',
  },
  label: {
    fontSize: '.8rem',
    fontWeight: 600,
    color: '#a1a1aa',
  },
  select: {
    padding: '.65rem .75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#0c0d14',
    color: '#e4e4e7',
    fontSize: '.9rem',
  },
  input: {
    padding: '.65rem .75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: '#0c0d14',
    color: '#e4e4e7',
    fontSize: '.9rem',
  },
  btn: {
    padding: '.8rem',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '.5rem',
  },
  whatsappBtn: {
    display: 'inline-block',
    padding: '.75rem 1.5rem',
    borderRadius: 10,
    background: '#25D366',
    color: '#fff',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: '1rem',
  },
  footer: {
    marginTop: '1rem',
    fontSize: '.75rem',
    color: '#52525b',
  },
};

export default function PagarPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontFamily: 'system-ui' }}>Cargando...</div>}>
      <PagarForm />
    </Suspense>
  );
}
