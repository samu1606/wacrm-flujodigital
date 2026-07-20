/**
 * POST /api/v1/broadcasts/evo — Evolution API broadcast (sin templates)
 *
 * Body:
 *   {
 *     "name": "Promo Julio",
 *     "message": "Hola {{name}}, tenemos 20% OFF...",
 *     "contactIds": ["uuid1", "uuid2"],
 *     "audience": { "type": "all" | "tags" | "csv", ... }  // futuro
 *   }
 *
 * Response (202): { "broadcast_id": "...", "total": 10 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createAndDeliverEvoBroadcast,
  BroadcastEvoError,
} from '@/lib/whatsapp/broadcast-evo';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id || profile?.id;
    if (!accountId) {
      return NextResponse.json(
        { error: 'Perfil no vinculado a una cuenta' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Body JSON requerido' },
        { status: 400 },
      );
    }

    const message: string = body.message || '';
    const name: string = body.name || '';
    const contactIds: string[] = Array.isArray(body.contactIds)
      ? body.contactIds
      : [];

    // Resolve contacts from IDs
    let contacts: { id: string; phone: string; name?: string }[] = [];

    if (contactIds.length > 0) {
      const { data: contactsData, error: cErr } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .in('id', contactIds);

      if (cErr) {
        return NextResponse.json(
          { error: 'Error al buscar contactos' },
          { status: 500 },
        );
      }

      contacts =
        contactsData?.map((c) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
        })) || [];
    } else if (body.audience?.type === 'all') {
      // All contacts for this account
      const { data: allContacts, error: allErr } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .order('created_at', { ascending: false })
        .limit(500);

      if (allErr) {
        return NextResponse.json(
          { error: 'Error al buscar contactos' },
          { status: 500 },
        );
      }

      contacts =
        allContacts?.map((c) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
        })) || [];
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron contactos para enviar' },
        { status: 400 },
      );
    }

    const result = await createAndDeliverEvoBroadcast(supabase, {
      name,
      messageText: message,
      contacts,
      accountId,
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        broadcast_id: result.broadcastId,
        total: result.total,
        message: `Difusión iniciada: ${result.total} destinatarios`,
      },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof BroadcastEvoError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error('[api/broadcasts/evo] Error:', err);
    const message = err instanceof BroadcastEvoError
      ? err.message
      : (err instanceof Error ? err.message : 'Error interno');
    return NextResponse.json(
      { error: message, detail: String(err) },
      { status: err instanceof BroadcastEvoError ? err.status : 500 },
    );
  }
}
