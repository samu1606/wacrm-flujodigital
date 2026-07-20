/**
 * POST /api/v1/broadcasts/test — endpoint de PRUEBA que crea una difusión directamente
 * sin frontend. Muestra el error completo si falla.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAndDeliverEvoBroadcast, BroadcastEvoError } from '@/lib/whatsapp/broadcast-evo';

export async function POST(request: NextRequest) {
  const log: string[] = [];

  try {
    const supabase = await createClient();
    log.push('1. supabase client created');

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      log.push(`2. AUTH FAILED: ${authErr?.message}`);
      return NextResponse.json({ status: 'fail', log }, { status: 401 });
    }
    log.push('2. auth OK');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, account_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const accountId = profile?.account_id || profile?.id;
    log.push(`3. profile: accountId=${accountId}`);

    // Get first 2 contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .limit(2);
    log.push(`4. contacts fetched: ${contactsData?.length || 0} rows`);

    if (!contactsData?.length) {
      log.push('FAIL: no contacts');
      return NextResponse.json({ status: 'fail', log });
    }

    // Try to create broadcast
    log.push('5. calling createAndDeliverEvoBroadcast...');
    const result = await createAndDeliverEvoBroadcast(supabase, {
      name: 'Test difusión',
      messageText: 'Hola {{name}}, esto es una prueba de difusión desde WASAPEA PRO 🚀',
      contacts: contactsData.map(c => ({ id: c.id, phone: c.phone || '573000000000', name: c.name })),
      accountId,
      userId: user.id,
    });

    log.push(`6. SUCCESS: broadcastId=${result.broadcastId}, total=${result.total}`);
    return NextResponse.json({ status: 'ok', broadcastId: result.broadcastId, total: result.total, log });

  } catch (err) {
    log.push(`CRASH: ${err instanceof Error ? err.message : String(err)}`);
    log.push(`STACK: ${err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : 'no stack'}`);
    
    if (err instanceof BroadcastEvoError) {
      log.push(`BroadcastEvoError: code=${err.code}, status=${err.status}`);
    }

    return NextResponse.json({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      code: err instanceof BroadcastEvoError ? err.code : 'unknown',
      log,
    }, { status: 500 });
  }
}
