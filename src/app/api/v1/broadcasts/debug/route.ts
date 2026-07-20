/**
 * GET /api/v1/broadcasts/debug — diagnóstico rápido de difusiones
 * Verifica: auth, perfil, contactos, instancia WhatsApp, permisos
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const supabase = await createClient();

    // 1. Auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    results.auth = authErr ? `ERROR: ${authErr.message}` : `OK (${user?.email})`;
    if (!user) {
      return NextResponse.json({ status: 'fail', results }, { status: 401 });
    }

    // 2. Profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, account_id, email')
      .eq('user_id', user.id)
      .maybeSingle();
    results.profile = profErr ? `ERROR: ${profErr.message}` : JSON.stringify(profile);
    const accountId = profile?.account_id || profile?.id;

    // 3. Contacts count
    const { count: contactCount, error: contactErr } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });
    results.contacts = contactErr ? `ERROR: ${contactErr.message}` : `${contactCount} contactos`;

    // 4. WhatsApp instance
    const { data: wi, error: wiErr } = await supabase
      .from('whatsapp_instances')
      .select('evolution_instance_name, status, phone_number')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    results.whatsapp = wiErr
      ? `ERROR: ${wiErr.message} (code: ${wiErr.code})`
      : wi
        ? `OK: ${wi.evolution_instance_name} (${wi.status})`
        : 'SIN INSTANCIA CONECTADA';

    // 5. First 2 contacts (sample)
    const { data: sampleContacts } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .limit(2);
    results.sampleContacts = sampleContacts;

    return NextResponse.json({ status: 'ok', results });

  } catch (err) {
    return NextResponse.json({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      results,
    }, { status: 500 });
  }
}
