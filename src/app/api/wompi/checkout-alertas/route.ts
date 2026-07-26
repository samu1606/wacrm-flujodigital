/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans.
 * Generates signed Wompi checkout URL (no HTML form, no payment-links API).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ALERT_PLANS: Record<string, { name: string; cents: number }> = {
  pro: { name: 'Alertas Pro', cents: 38_000_00 },
  empresarial: { name: 'Alertas Empresarial', cents: 80_000_00 },
};

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, plan: planKey } = body;

    if (!phone || !planKey) {
      return NextResponse.json({ error: 'phone and plan required' }, { status: 400 });
    }

    const plan = ALERT_PLANS[planKey];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const reference = `alertas-${planKey}-${phone}-${Date.now()}`;
    const integrityKey = process.env.WOMPI_INTEGRITY_KEY || '';
    const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://148.230.90.171:8095'}/checkout-alertas?paid=true`;

    // Build Wompi checkout URL
    let checkoutUrl = `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=COP&amount-in-cents=${plan.cents}&reference=${reference}&redirect-url=${encodeURIComponent(redirectUrl)}`;

    // Integrity signature
    if (integrityKey) {
      const hash = createHash('sha256').update(`${reference}${plan.cents}COP${integrityKey}`).digest('hex');
      checkoutUrl += `&signature:integrity=${hash}`;
    }

    // Save record
    const admin = supabaseAdmin();
    await admin.from('payments').insert({
      plan: `alertas_${planKey}`,
      amount_cents: plan.cents,
      reference,
      status: 'pending',
      metadata: { phone, product: 'alertas' },
    }).select('id').maybeSingle();

    return NextResponse.json({
      checkoutUrl,
      planName: plan.name,
      amount: plan.cents / 100,
      phone,
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
