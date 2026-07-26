/**
 * POST /api/pagar — Registra pago, activa PRO automático, notifica a Edwin
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || 'http://evolution-saas:8080'
const EVO_KEY = process.env.EVOLUTION_API_KEY || ''

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PRODUCT_LABELS: Record<string, string> = {
  cryptotrader: '💰 CryptoTrader',
  forexalert: '💱 ForexAlert',
  goldtrack: '🥇 GoldTrack',
  trm: '💵 TRM Alertas',
  secop: '📋 SECOP Alertas',
  vigilante: '🛡️ Vigilante Digital',
  pro: '⭐ Plan PRO',
}

export async function POST(request: NextRequest) {
  try {
    const { phone, product, amount } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Número de WhatsApp requerido' }, { status: 400 })
    }
    if (!product) {
      return NextResponse.json({ error: 'Producto requerido' }, { status: 400 })
    }

    const admin = supabaseAdmin()

    // 1. Guardar comprobante en payment_proofs
    const { error: proofErr } = await admin.from('payment_proofs').insert({
      phone,
      product,
      amount: amount || '',
      status: 'approved',
      metadata: { source: 'pagar_page', ip: request.headers.get('x-forwarded-for') || '' },
    })

    if (proofErr) {
      console.error('[pagar] Proof insert error:', proofErr.message)
    }

    // 2. Activar PRO en alert_subscribers
    const productLabel = PRODUCT_LABELS[product] || product

    const { error: subErr } = await admin
      .from('alert_subscribers')
      .upsert({
        phone,
        product,
        plan: 'pro',
        active: true,
        trial_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'phone,product',
      })

    if (subErr) {
      console.error('[pagar] Subscriber update error:', subErr.message)
      return NextResponse.json({ error: 'Error al activar suscripción' }, { status: 500 })
    }

    // 3. Notificar a Edwin por WhatsApp
    if (EVO_URL && EVO_KEY) {
      const adminMsg = `💰 *Nuevo pago recibido*\n\n${productLabel}\n📱 +${phone}\n💵 ${amount || 'N/A'}\n\n✅ Suscripción activada automáticamente.`
      try {
        await fetch(`${EVO_URL}/message/sendText/wasapea-7c7a2c6c`, {
          method: 'POST',
          headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: '573173662752', text: adminMsg }),
        })
      } catch {
        console.warn('[pagar] Could not notify Edwin')
      }
    }

    // 4. Confirmar al usuario por WhatsApp
    if (EVO_URL && EVO_KEY) {
      const userMsg = `${productLabel}\n\n✅ *¡Pago confirmado! Tu suscripción PRO está activa.*\n\nSeguirás recibiendo alertas sin interrupción. Gracias 🫡`
      try {
        await fetch(`${EVO_URL}/message/sendText/wasapea-7c7a2c6c`, {
          method: 'POST',
          headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone, text: userMsg }),
        })
      } catch {
        console.warn('[pagar] Could not notify user')
      }
    }

    return NextResponse.json({ status: 'ok', message: 'Pago registrado y suscripción activada' })
  } catch (err: any) {
    console.error('[pagar] Error:', err.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
