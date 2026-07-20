/**
 * POST /api/wompi/webhook — Receive payment events from Wompi.
 *
 * Wompi sends events like:
 *   transaction.updated → payment status changed
 *
 * Headers: x-event-checksum (HMAC-SHA256 of body with WOMPI_EVENTS_KEY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWompiSignature, getWompiTransaction } from '@/lib/wompi/client';

let _admin: any = null;
function supabaseAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const checksum = request.headers.get('x-event-checksum') || '';

  // Verify signature
  if (!verifyWompiSignature(rawBody, checksum)) {
    console.error('[wompi/webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event?.event || '';
  const txData = event?.data?.transaction || {};

  console.log('[wompi/webhook] Event:', eventType, 'Tx:', txData?.id, 'Status:', txData?.status);

  // Only handle transaction.updated events
  if (!eventType.includes('transaction')) {
    return NextResponse.json({ status: 'ignored', reason: 'not_transaction' });
  }

  const txId = txData?.id;
  const status = txData?.status;
  const reference = txData?.reference;

  if (!txId) {
    return NextResponse.json({ status: 'skipped', reason: 'no_tx_id' });
  }

  const admin = supabaseAdmin();

  // Find our payment record
  const { data: payment } = await admin
    .from('payments')
    .select('id, account_id, plan, user_id')
    .eq('wompi_tx_id', txId)
    .maybeSingle();

  if (!payment) {
    // Payment might be from a different source or test
    console.warn('[wompi/webhook] Payment not found for tx:', txId);
    return NextResponse.json({ status: 'skipped', reason: 'unknown_tx' });
  }

  // Update payment status
  await admin
    .from('payments')
    .update({
      status,
      wompi_data: event,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (status === 'APPROVED') {
    // Calculate subscription end date (monthly from now)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    // Upsert subscription
    const { error: subErr } = await admin
      .from('subscriptions')
      .upsert(
        {
          account_id: payment.account_id,
          plan: payment.plan,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          last_payment_id: payment.id,
          updated_at: now.toISOString(),
        },
        { onConflict: 'account_id' }
      );

    if (subErr) {
      console.error('[wompi/webhook] Subscription upsert error:', subErr.message);
      return NextResponse.json({ status: 'error', error: subErr.message }, { status: 500 });
    }

    console.log(`[wompi/webhook] ✅ Subscription activated: ${payment.plan} for account ${payment.account_id}`);
  }

  return NextResponse.json({ status: 'ok' });
}
