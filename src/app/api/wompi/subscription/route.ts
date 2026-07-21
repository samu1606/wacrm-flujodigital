/**
 * GET /api/wompi/subscription — Get current account subscription status.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ plan: 'free', status: 'no_subscription', trialDaysLeft: 0 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ plan: 'free', status: 'no_subscription', trialDaysLeft: 0 });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('account_id', profile.account_id)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ plan: 'free', status: 'no_subscription', trialDaysLeft: 0 });
    }

    // Calculate trial days remaining
    let trialDaysLeft = 0;
    if (sub.trial_end) {
      const end = new Date(sub.trial_end);
      const now = new Date();
      trialDaysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const isTrialExpired = sub.status === 'trial' && trialDaysLeft <= 0;

    return NextResponse.json({
      plan: sub.plan,
      status: isTrialExpired ? 'expired' : sub.status,
      trialDaysLeft,
      trialStart: sub.trial_start,
      currentPeriodEnd: sub.current_period_end,
    });
  } catch (err) {
    console.error('[wompi/subscription] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
