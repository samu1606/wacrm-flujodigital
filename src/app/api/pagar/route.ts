/**
 * POST /api/pagar — Guarda comprobante de pago Nequi
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
    const { error } = await admin.from('payment_proofs').insert({
      phone,
      product,
      amount: amount || '',
      status: 'pending',
      metadata: { source: 'pagar_page', ip: request.headers.get('x-forwarded-for') || '' },
    })

    if (error) {
      console.error('[pagar] Insert error:', error.message)
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok', message: 'Comprobante registrado' })
  } catch (err: any) {
    console.error('[pagar] Error:', err.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
