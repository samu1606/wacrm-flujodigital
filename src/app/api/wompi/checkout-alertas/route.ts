/**
 * POST /api/wompi/checkout-alertas — Public checkout for alert plans.
 * Uses Wompi API server-side to generate a payment link (avoids CORS/HTTP origin issues).
 */
import { NextRequest, NextResponse } from 'next/server';

const ALERT_PLANS: Record<string, { name: string; cents: number }> = {
  pro: { name: 'Alertas Pro', cents: 38_000_00 },
  empresarial: { name: 'Alertas Empresarial', cents: 80_000_00 },
};

const WOMPI_API = 'https://api.wompi.co/v1';

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
    const privateKey = process.env.WOMPI_PRIVATE_KEY || '';

    // Create payment link via Wompi API (server-side, no CORS)
    const wompiRes = await fetch(`${WOMPI_API}/payment_links`, {
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
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://148.230.90.171:8095'}/checkout-alertas?paid=true`,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }),
    });

    const data = await wompiRes.json();

    if (!wompiRes.ok) {
      console.error('[checkout-alertas] Wompi API error:', data);
      return NextResponse.json({
        error: 'Wompi rechazó la solicitud',
        detail: data?.error?.messages?.join?.('; ') || data?.error?.type || JSON.stringify(data) || 'Error desconocido',
      }, { status: 502 });
    }

    const paymentUrl = data?.data?.url || data?.data?.payment_url;
    if (!paymentUrl) {
      console.error('[checkout-alertas] No payment URL in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'Wompi no devolvió URL de pago' }, { status: 502 });
    }

    return NextResponse.json({
      paymentUrl,
      reference,
      plan: planKey,
      planName: plan.name,
      phone,
    });
  } catch (e) {
    console.error('[checkout-alertas] Error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
