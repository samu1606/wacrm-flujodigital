/**
 * POST /api/wompi/checkout — Return data for Wompi.js widget.
 *
 * Body: { plan: "emprendedor" | "pro" | "business" }
 * Returns: { publicKey, reference, amountInCents, currency, signatureIntegrity }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';

const PLAN_PRICES: Record<string, { name: string; cents: number }> = {
  emprendedor: { name: 'Emprendedor', cents: 15_00 },
  pro: { name: 'PRO', cents: 29_00 },
  business: { name: 'Business', cents: 69_00 },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const planKey = body?.plan || 'emprendedor';
    const plan = PLAN_PRICES[planKey];

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, email, full_name, phone')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const reference = `wasapea-${planKey}-${Date.now()}-${profile.account_id.slice(0, 8)}`;
    const currency = 'COP';
    const cents = plan.cents;
    const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
    const integrityKey = process.env.WOMPI_EVENTS_KEY || '';

    // Wompi integrity signature: SHA256(reference + amountCents + currency + integrityKey)
    const signature = createHash('sha256')
      .update(`${reference}${cents}${currency}${integrityKey}`)
      .digest('hex');

    // Store pending payment record
    await supabase.from('payments').insert({
      account_id: profile.account_id,
      reference,
      plan: planKey,
      amount_cents: cents,
      status: 'pending',
      user_id: user.id,
    });

    return NextResponse.json({
      publicKey,
      reference,
      amountInCents: cents,
      currency,
      signatureIntegrity: signature,
      customerEmail: profile.email || user.email || '',
      customerName: profile.full_name || user.user_metadata?.full_name || '',
      customerPhone: profile.phone || '',
    });
  } catch (err) {
    console.error('[wompi/checkout] Error:', err);
    return NextResponse.json(
      { error: 'Payment setup failed', detail: String(err) },
      { status: 500 }
    );
  }
}
