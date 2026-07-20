/**
 * POST /api/wompi/checkout — Create a Wompi payment link for a plan.
 *
 * Body: { plan: "emprendedor" | "pro" | "business" }
 * Returns: { redirectUrl }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWompiTransaction } from '@/lib/wompi/client';

const PLAN_PRICES: Record<string, { name: string; cents: number }> = {
  emprendedor: { name: 'Emprendedor', cents: 15_00 },  // $15 = 1500 cents
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

    // Get user's account
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, email')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const reference = `wasapea-${planKey}-${Date.now()}-${profile.account_id.slice(0, 8)}`;
    const returnUrl = `${request.nextUrl.origin}/settings?tab=subscription`;

    const tx = await createWompiTransaction({
      amountInCents: plan.cents,
      currency: 'COP',
      customerEmail: profile.email || user.email || '',
      reference,
      returnUrl,
    });

    // Log the pending payment in DB
    await supabase.from('payments').insert({
      account_id: profile.account_id,
      wompi_tx_id: tx.id,
      reference,
      plan: planKey,
      amount_cents: plan.cents,
      status: 'pending',
      user_id: user.id,
    });

    return NextResponse.json({
      redirectUrl: tx.redirectUrl,
      txId: tx.id,
      reference,
    });
  } catch (err) {
    console.error('[wompi/checkout] Error:', err);
    return NextResponse.json(
      { error: 'Payment setup failed', detail: String(err) },
      { status: 500 }
    );
  }
}
