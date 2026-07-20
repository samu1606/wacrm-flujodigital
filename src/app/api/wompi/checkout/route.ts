/**
 * POST /api/wompi/checkout — Return data for Wompi.js widget.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const PLAN_PRICES: Record<string, { name: string; cents: number }> = {
  emprendedor: { name: 'Emprendedor', cents: 15_00 },
  pro: { name: 'PRO', cents: 29_00 },
  business: { name: 'Business', cents: 69_00 },
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    // Try to get profile.account_id, fall back to profile.id
    const admin = adminClient();

    // First try: get existing profile
    let { data: profile } = await admin
      .from('profiles')
      .select('id, account_id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    // If no profile exists, create one
    if (!profile) {
      const { data: newProfile, error: createErr } = await admin
        .from('profiles')
        .insert({ user_id: user.id, full_name: user.email || 'Usuario', email: user.email })
        .select('id, account_id, email')
        .single();

      if (createErr) {
        console.error('[wompi/checkout] Auto-create profile failed:', createErr.message);
      } else if (newProfile) {
        profile = newProfile;
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'No account found', detail: 'Cierra sesión y vuelve a entrar' },
        { status: 400 }
      );
    }

    // Use account_id if present, otherwise use profile.id
    const accountRef = profile.account_id || profile.id;

    const reference = `wasapea-${planKey}-${Date.now()}-${String(accountRef).slice(0, 8)}`;
    const currency = 'COP';
    const cents = plan.cents;
    const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
    const integrityKey = process.env.WOMPI_EVENTS_KEY || '';

    const signature = createHash('sha256')
      .update(`${reference}${cents}${currency}${integrityKey}`)
      .digest('hex');

    // Store pending payment
    await admin.from('payments').insert({
      account_id: accountRef,
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
      customerName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente',
      customerPhone: user.phone || '',
    });
  } catch (err) {
    console.error('[wompi/checkout] Error:', err);
    return NextResponse.json(
      { error: 'Payment setup failed', detail: String(err) },
      { status: 500 }
    );
  }
}
