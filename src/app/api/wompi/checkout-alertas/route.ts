/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans.
 * Returns config for Wompi.js widget (same pattern as CRM checkout).
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
    const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
    const integrityKey = process.env.WOMPI_INTEGRITY_KEY || '';

    // Generate integrity signature (same format as CRM checkout)
    const signatureIntegrity = createHash('sha256')
      .update(`${reference}${plan.cents}COP${integrityKey}`)
      .digest('hex');

    // Save payment record
    const admin = supabaseAdmin();
    await admin.from('payments').insert({
      plan: `alertas_${planKey}`,
      amount_cents: plan.cents,
      reference,
      status: 'pending',
      metadata: { phone, product: 'alertas' },
    }).select('id').maybeSingle();

    return NextResponse.json({
      publicKey,
      reference,
      amountInCents: plan.cents,
      currency: 'COP',
      signatureIntegrity,
      planName: plan.name,
      phone,
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
