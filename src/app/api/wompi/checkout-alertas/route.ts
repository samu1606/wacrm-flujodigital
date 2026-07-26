/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ALERT_PLANS: Record<string, { name: string; cents: number }> = {
  pro: { name: 'Alertas Pro', cents: 38_000_00 },
  empresarial: { name: 'Alertas Empresarial', cents: 80_000_00 },
};

const CURRENCY = 'COP';

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
      return NextResponse.json({ error: 'Invalid plan. Use pro or empresarial' }, { status: 400 });
    }

    const reference = `alertas-${planKey}-${phone}-${Date.now()}`;
    const integrityKey = process.env.WOMPI_INTEGRITY_KEY || '';

    // Generate Wompi integrity signature (required in production)
    const integrity = integrityKey
      ? createHash('sha256').update(`${reference}${plan.cents}${CURRENCY}${integrityKey}`).digest('hex')
      : '';

    // Save payment record
    const admin = supabaseAdmin();
    const { error } = await admin
      .from('payments')
      .insert({
        plan: `alertas_${planKey}`,
        amount_cents: plan.cents,
        reference,
        status: 'pending',
        metadata: { phone, product: 'alertas' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[checkout-alertas] Payment insert error:', error);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({
      reference,
      amount: plan.cents,
      currency: CURRENCY,
      integrity,
      plan: planKey,
      planName: plan.name,
      phone,
      wompiPublicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || '',
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
