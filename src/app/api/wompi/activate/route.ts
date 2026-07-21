/**
 * POST /api/wompi/activate — Directly activate a subscription from the Widget callback.
 * This is the RELIABLE fallback when Wompi's webhook isn't configured or fails.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference, plan, transactionId } = body;

    if (!reference || !plan) {
      return NextResponse.json({ error: 'Missing reference or plan' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Find the payment record by reference
    const { data: payment } = await admin
      .from('payments')
      .select('id, account_id, plan, user_id')
      .eq('reference', reference)
      .maybeSingle();

    if (!payment) {
      console.warn('[wompi/activate] Payment not found for reference:', reference);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Mark payment as approved
    await admin
      .from('payments')
      .update({
        status: 'APPROVED',
        wompi_tx_id: transactionId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    // Activate subscription
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const { error: subErr } = await admin
      .from('subscriptions')
      .upsert(
        {
          account_id: payment.account_id,
          plan: plan,
          status: 'active',
          trial_start: null,
          trial_end: null,
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          last_payment_id: payment.id,
          updated_at: now.toISOString(),
        },
        { onConflict: 'account_id' }
      );

    if (subErr) {
      console.error('[wompi/activate] Subscription upsert error:', subErr.message);
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 });
    }

    console.log(`[wompi/activate] ✅ ACTIVATED: ${plan} for ${payment.account_id} (ref: ${reference})`);

    return NextResponse.json({
      status: 'ok',
      plan,
      message: `Subscription activated: ${plan}`,
    });
  } catch (err: any) {
    console.error('[wompi/activate] Error:', err.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
