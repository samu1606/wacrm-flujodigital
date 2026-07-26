/**
 * POST /api/wompi/webhook — Receive payment events from Wompi.
 *
 * Wompi sends events like: transaction.updated
 * Headers: x-event-checksum (HMAC-SHA256 of body with WOMPI_EVENTS_KEY)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWompiSignature } from '@/lib/wompi/client';

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

async function activateSubscription(paymentRecord: any, txId: string) {
  const admin = supabaseAdmin();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  const { error: subErr } = await admin
    .from('subscriptions')
    .upsert(
      {
        account_id: paymentRecord.account_id,
        plan: paymentRecord.plan,
        status: 'active',
        trial_start: null,
        trial_end: null,
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        last_payment_id: paymentRecord.id,
        updated_at: now.toISOString(),
      },
      { onConflict: 'account_id' }
    );

  if (subErr) {
    console.error('[wompi/webhook] Subscription upsert error:', subErr.message);
    return false;
  }

  console.log(`[wompi/webhook] ✅ Activated: ${paymentRecord.plan} for ${paymentRecord.account_id}`);
  return true;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const checksum = request.headers.get('x-event-checksum') || '';

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

  console.log('[wompi/webhook] 📩 Event:', eventType, '| Tx:', txData?.id, '| Status:', txData?.status, '| Ref:', txData?.reference);

  if (!eventType.includes('transaction')) {
    return NextResponse.json({ status: 'ignored' });
  }

  const txId = txData?.id;
  const status = txData?.status;
  const reference = txData?.reference;

  if (!txId || !reference) {
    return NextResponse.json({ status: 'skipped', reason: 'missing_data' });
  }

  const admin = supabaseAdmin();

  // Find payment by txId first, then by reference (widget flow)
  let { data: payment } = await admin
    .from('payments')
    .select('id, account_id, plan, user_id, wompi_tx_id')
    .eq('wompi_tx_id', txId)
    .maybeSingle();

  if (!payment) {
    // Look by reference (widget creates payment before transaction exists)
    const { data: refPayment } = await admin
      .from('payments')
      .select('id, account_id, plan, user_id, wompi_tx_id')
      .eq('reference', reference)
      .maybeSingle();

    if (refPayment) {
      payment = refPayment;
      // Link the transaction ID
      await admin
        .from('payments')
        .update({ wompi_tx_id: txId })
        .eq('id', payment.id);
    }
  }

  if (!payment) {
    // Check if this is an alertas payment (payment link — no payments record)
    if (reference?.startsWith('alertas-') && status === 'APPROVED') {
      await upgradeAlertSubscriberFromRef(reference);
    }
    console.warn('[wompi/webhook] Payment not found for tx:', txId, 'ref:', reference);
    return NextResponse.json({ status: 'skipped', reason: 'unknown' });
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
    await activateSubscription(payment, txId);

    // Also handle alertas plan upgrades
    if (payment.plan?.startsWith('alertas_')) {
      await upgradeAlertSubscriber(payment);
    }
  }

  return NextResponse.json({ status: 'ok' });
}

async function upgradeAlertSubscriber(payment: any) {
  const admin = supabaseAdmin();

  // Get phone from reference: alertas-pro-573001234567-1234567890
  const refParts = payment.reference?.split('-') || [];
  const phone = refParts.length >= 3 ? refParts[2] : null;

  if (!phone) {
    console.warn('[wompi/webhook] Could not extract phone from reference:', payment.reference);
    return;
  }

  const alertPlan = (payment.plan || '').replace('alertas_', '');

  // Update all alert subscriptions for this phone to the new plan
  const { error } = await admin
    .from('alert_subscribers')
    .update({
      plan: alertPlan,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('phone', phone);

  if (error) {
    console.error('[wompi/webhook] Alert upgrade error:', error.message);
    return;
  }

  console.log(`[wompi/webhook] ✅ Alert upgrade: ${phone} → ${alertPlan}`);
}

async function upgradeAlertSubscriberFromRef(reference: string) {
  const admin = supabaseAdmin();

  // reference format: alertas-pro-573001234567-1234567890
  const refParts = reference.split('-');
  const alertPlan = refParts[1] || 'pro';
  const phone = refParts[2] || null;

  if (!phone) {
    console.warn('[wompi/webhook] Could not extract phone from reference:', reference);
    return;
  }

  const { error } = await admin
    .from('alert_subscribers')
    .update({
      plan: alertPlan,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('phone', phone);

  if (error) {
    console.error('[wompi/webhook] Alert upgrade from ref error:', error.message);
    return;
  }

  console.log(`[wompi/webhook] ✅ Alert upgrade (payment link): ${phone} → ${alertPlan}`);
}
