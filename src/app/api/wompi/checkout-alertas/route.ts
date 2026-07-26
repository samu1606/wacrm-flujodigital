/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans.
 */
import { NextRequest, NextResponse } from 'next/server';
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
    const privateKey = process.env.WOMPI_PRIVATE_KEY || '';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wasapeapro.com';

    // Try creating a payment link via Wompi API
    const wompiRes = await fetch('https://api.wompi.co/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${plan.name} — ${phone}`,
        amount_in_cents: plan.cents,
        currency: 'COP',
        reference,
        redirect_url: `${siteUrl}/checkout-alertas?paid=true`,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }),
    });

    const wompiData = await wompiRes.json();

    if (!wompiRes.ok || wompiData.error) {
      const reason = wompiData?.error?.reason || wompiData?.error?.type || JSON.stringify(wompiData);
      console.error('[checkout-alertas] Wompi error:', reason);

      // Fallback: build direct checkout URL
      const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
      const checkoutUrl = `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=COP&amount-in-cents=${plan.cents}&reference=${reference}&redirect-url=${encodeURIComponent(`${siteUrl}/checkout-alertas?paid=true`)}`;

      // Save record anyway
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
        note: reason,
      });
    }

    // Success: Wompi gave us a payment link
    const paymentUrl = wompiData?.data?.url || wompiData?.data?.payment_url;

    if (!paymentUrl) {
      return NextResponse.json({ error: 'Wompi no devolvió URL de pago' }, { status: 502 });
    }

    return NextResponse.json({
      paymentUrl,
      reference,
      planName: plan.name,
      phone,
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
