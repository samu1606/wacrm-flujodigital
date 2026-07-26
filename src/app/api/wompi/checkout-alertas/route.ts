/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALERT_PLANS: Record<string, { name: string; cents: number }> = {
  pro: { name: 'Alertas Pro', cents: 38_000_00 },    // $9 USD ≈ $38K COP
  empresarial: { name: 'Alertas Empresarial', cents: 80_000_00 }, // $19 USD ≈ $80K COP
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
      return NextResponse.json({ error: 'Invalid plan. Use pro or empresarial' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const reference = `alertas-${planKey}-${phone}-${Date.now()}`;

    // Create payment record
    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        plan: `alertas_${planKey}`,
        amount: plan.cents,
        reference,
        status: 'pending',
        metadata: { phone, product: 'alertas' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[checkout-alertas] Payment insert error:', error);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    // Wompi payment link
    const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || '';

    return NextResponse.json({
      reference,
      amount: plan.cents,
      currency: 'COP',
      plan: planKey,
      planName: plan.name,
      phone,
      wompiPublicKey,
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
