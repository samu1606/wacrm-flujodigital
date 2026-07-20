/**
 * Evolution API broadcast engine.
 *
 * Delivers text broadcasts through WhatsApp Web (Baileys) via Evolution
 * API — NO Meta templates required. Rate-limited to avoid WhatsApp bans:
 *   8-12 msg/min conservative, with configurable delay between sends.
 *
 * Designed to run inside Next.js `after()` for async fan-out.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { evoSendText } from '@/lib/whatsapp/evolution-api';
import { rateLimiterCheck } from '@/lib/whatsapp/rate-limiter';

export class BroadcastEvoError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'BroadcastEvoError';
    this.code = code;
    this.status = status;
  }
}

export interface EvoBroadcastInput {
  name: string;
  messageText: string;
  /** Contact IDs or phone numbers to send to. */
  contacts: { id: string; phone: string; name?: string }[];
  accountId: string;
  userId: string;
}

/** Sends/hour below WhatsApp limits (~30-50 per hour per device). */
const DELAY_MS = 3_000; // 3s between sends = 20/min (safe for WhatsApp Web)

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Create the broadcast row + recipients, then fan out via Evolution API.
 * Returns the broadcast ID for polling.
 */
export async function createAndDeliverEvoBroadcast(
  db: SupabaseClient,
  input: EvoBroadcastInput,
): Promise<{ broadcastId: string; total: number }> {
  const { name, messageText, contacts, accountId, userId } = input;

  // 1. Validate
  if (!messageText?.trim()) {
    throw new BroadcastEvoError('bad_request', 'El mensaje no puede estar vacío', 400);
  }
  if (!contacts.length) {
    throw new BroadcastEvoError('bad_request', 'Selecciona al menos un contacto', 400);
  }

  // 2. Verify Evolution instance is connected (use passed-in DB client for RLS)
  const { data: inst, error: instErr } = await db
    .from('whatsapp_instances')
    .select('evolution_instance_name, status, phone_number')
    .eq('account_id', accountId)
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (instErr || !inst) {
    throw new BroadcastEvoError(
      'no_instance',
      `No hay WhatsApp conectado para esta cuenta (${instErr?.message || 'sin instancia'}). Conecta tu WhatsApp primero en Configuración.`,
      400,
    );
  }
  if (inst.status !== 'connected') {
    throw new BroadcastEvoError(
      'instance_not_connected',
      `WhatsApp está ${inst.status}. Reconecta en Configuración.`,
      400,
    );
  }

  const instanceName = inst.evolution_instance_name!;
  console.log(`[broadcast-evo] Using instance: ${instanceName} (status: ${inst.status})`);

  // 3. Create broadcast row (use user_id, NOT account_id — broadcasts table is user-scoped,
  // BUT migration 017 added account_id NOT NULL, so we need both)
  const { data: broadcast, error: bErr } = await db
    .from('broadcasts')
    .insert({
      account_id: accountId,
      user_id: userId,
      name: name || `Difusión: ${messageText.slice(0, 50)}`,
      template_name: '__evo_simple__',  // Evolution API doesn't use templates
      template_language: 'es',
      status: 'sending',
      total_recipients: contacts.length,
    })
    .select('id')
    .single();

  if (bErr || !broadcast) {
    throw new BroadcastEvoError('internal', 'Error al crear la difusión', 500);
  }

  // 4. Create recipient rows
  const { error: rErr } = await db.from('broadcast_recipients').insert(
    contacts.map((c) => ({
      broadcast_id: broadcast.id,
      contact_id: c.id,
      status: 'pending' as const,
    })),
  );

  if (rErr) {
    console.error('[broadcast-evo] Recipients insert error:', rErr);
  }

  // 5. Fan out (async — caller should fire-and-forget or use after())
  deliverEvoBroadcast(db, broadcast.id, instanceName, contacts, messageText).catch((err) => {
    console.error('[broadcast-evo] Delivery failed:', err);
  });

  return { broadcastId: broadcast.id, total: contacts.length };
}

/**
 * Fan out: send the message to each recipient sequentially with rate-limiting.
 * Designed to be called from `after()` — the HTTP response returns before
 * all messages are sent.
 */
export async function deliverEvoBroadcast(
  db: SupabaseClient,
  broadcastId: string,
  instanceName: string,
  contacts: { id: string; phone: string; name?: string }[],
  message: string,
): Promise<void> {
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    // Rate limit check (broadcast type: 10/min, hard cap 50/min)
    const limit = rateLimiterCheck(instanceName, 'broadcast');
    if (!limit.allowed) {
      console.warn(
        `[broadcast-evo] Rate limited for ${instanceName}, waiting ${limit.retryAfterSec}s...`,
      );
      await sleep((limit.retryAfterSec || 10) * 1000);

      // Recheck after waiting
      const limit2 = rateLimiterCheck(instanceName, 'broadcast');
      if (!limit2.allowed) {
        console.error(`[broadcast-evo] Still rate limited, skipping remaining`);
        failedCount += contacts.length - i;
        break;
      }
    }

    try {
      // Optional: personalize message with contact name
      const personalized = message.replace(/\{\{name\}\}/g, contact.name || '');
      const personalizedMsg = personalized.replace(
        /\{\{phone\}\}/g,
        contact.phone || '',
      );

      const result = await evoSendText(contact.phone, personalizedMsg);

      await db
        .from('broadcast_recipients')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('broadcast_id', broadcastId)
        .eq('contact_id', contact.id);

      sentCount++;
      console.log(
        `[broadcast-evo] [${i + 1}/${contacts.length}] Sent to ${contact.phone}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      console.error(
        `[broadcast-evo] [${i + 1}/${contacts.length}] Failed ${contact.phone}:`,
        msg,
      );

      await db
        .from('broadcast_recipients')
        .update({
          status: 'failed',
          error_message: msg,
        })
        .eq('broadcast_id', broadcastId)
        .eq('contact_id', contact.id);

      failedCount++;
    }

    // Delay between sends (skip last)
    if (i < contacts.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Finalize broadcast
  await db
    .from('broadcasts')
    .update({
      status: sentCount > 0 ? 'sent' : 'failed',
      sent_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', broadcastId);

  console.log(
    `[broadcast-evo] Broadcast ${broadcastId} finished: ${sentCount} sent, ${failedCount} failed`,
  );
}
