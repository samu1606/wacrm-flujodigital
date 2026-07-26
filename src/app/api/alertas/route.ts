import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PRODUCTS = ['cryptotrader', 'forexalert', 'goldtrack', 'secop', 'trm', 'vigilante'] as const
type Product = typeof PRODUCTS[number]

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('alert_subscribers')
    .select('*')
    .eq('phone', phone)
    .order('product')

  if (error) {
    // Table might not exist yet
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ subscriptions: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { phone, product, plan, active, config } = body

  if (!phone || !product) {
    return NextResponse.json({ error: 'phone and product required' }, { status: 400 })
  }

  if (!PRODUCTS.includes(product)) {
    return NextResponse.json({ error: `invalid product: ${product}` }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Upsert: insert or update
  const { data, error } = await admin
    .from('alert_subscribers')
    .upsert({
      phone,
      product,
      plan: plan || 'free',
      active: active !== undefined ? active : true,
      config: config || {},
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'phone,product',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ subscription: data })
}

export async function DELETE(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  const product = req.nextUrl.searchParams.get('product')

  if (!phone || !product) {
    return NextResponse.json({ error: 'phone and product required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('alert_subscribers')
    .delete()
    .eq('phone', phone)
    .eq('product', product)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
