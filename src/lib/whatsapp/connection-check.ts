/**
 * WhatsApp connection checker — account-scoped.
 *
 * An account can be connected via Meta Cloud API (whatsapp_config)
 * OR Evolution API (whatsapp_instances). This shared helper tells
 * callers which transport is available so they can route accordingly.
 *
 * All checking functions accept a SupabaseClient (server-side route
 * handler) or accountId string (plain helper).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isEvolutionProvider } from '@/lib/whatsapp/evolution-api';

export type WhatsAppConnection =
  | { type: 'meta'; wabaId: string | null }
  | { type: 'evolution'; instanceName: string }
  | { type: 'none' };

/**
 * Check if ANY WhatsApp transport is available for this account.
 * Returns the connection type so callers can route correctly.
 */
export async function checkWhatsAppConnection(
  db: SupabaseClient,
  accountId: string,
): Promise<WhatsAppConnection> {
  // 1. Check Evolution instance (per-account, multi-tenant)
  const { data: evoInstance } = await db
    .from('whatsapp_instances')
    .select('evolution_instance_name, status')
    .eq('account_id', accountId)
    .eq('status', 'connected')
    .maybeSingle();

  if (evoInstance?.evolution_instance_name) {
    return {
      type: 'evolution',
      instanceName: evoInstance.evolution_instance_name,
    };
  }

  // 2. Check Meta config (per-account)
  const { data: metaConfig } = await db
    .from('whatsapp_config')
    .select('waba_id, status')
    .eq('account_id', accountId)
    .maybeSingle();

  if (metaConfig?.status === 'connected') {
    return {
      type: 'meta',
      wabaId: metaConfig.waba_id ?? null,
    };
  }

  return { type: 'none' };
}

/**
 * Quick boolean: is ANY WhatsApp transport connected for this account?
 * Use when callers only need yes/no (e.g., blocking a UI action).
 */
export async function isWhatsAppAvailable(
  db: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const conn = await checkWhatsAppConnection(db, accountId);
  return conn.type !== 'none';
}

/**
 * Server-only (no db client needed): is the global provider set to
 * Evolution? This is a deployment-level flag, not per-account.
 */
export function isGlobalEvolutionMode(): boolean {
  return isEvolutionProvider();
}
