/**
 * WhatsApp instance database helpers.
 * Maps CRM accounts ↔ Evolution API instances for multi-tenancy.
 */

import { db } from '@/lib/db';
import type { Database } from '@/lib/db/types';

export type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];

/** Get the active WhatsApp instance for an account. */
export async function getAccountInstance(accountId: string): Promise<WhatsAppInstance | null> {
  const { data, error } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/** Get any instance (connected or not) for an account. */
export async function getAnyAccountInstance(accountId: string): Promise<WhatsAppInstance | null> {
  const { data, error } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/** Find instance by Evolution instance name (for webhook routing). */
export async function getInstanceByName(
  evolutionInstanceName: string
): Promise<WhatsAppInstance | null> {
  const { data, error } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('evolution_instance_name', evolutionInstanceName)
    .single();

  if (error || !data) return null;
  return data;
}

/** Create or update a WhatsApp instance record. */
export async function upsertInstance(params: {
  accountId: string;
  instanceName: string;
  evolutionInstanceId?: string;
  status?: string;
  phoneNumber?: string;
  ownerJid?: string;
  profileName?: string;
  qrCode?: string | null;
  errorMessage?: string | null;
}): Promise<WhatsAppInstance> {
  const { data, error } = await db
    .from('whatsapp_instances')
    .upsert(
      {
        account_id: params.accountId,
        evolution_instance_name: params.instanceName,
        evolution_instance_id: params.evolutionInstanceId || null,
        status: params.status || 'pending',
        phone_number: params.phoneNumber || null,
        owner_jid: params.ownerJid || null,
        profile_name: params.profileName || null,
        qr_code: params.qrCode || null,
        error_message: params.errorMessage || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'evolution_instance_name',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert instance: ${error.message}`);
  return data;
}

/** Update instance status. */
export async function updateInstanceStatus(
  instanceName: string,
  status: string,
  extras?: {
    phoneNumber?: string;
    ownerJid?: string;
    profileName?: string;
    errorMessage?: string;
    qrCode?: string | null;
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extras?.phoneNumber !== undefined) update.phone_number = extras.phoneNumber;
  if (extras?.ownerJid !== undefined) update.owner_jid = extras.ownerJid;
  if (extras?.profileName !== undefined) update.profile_name = extras.profileName;
  if (extras?.errorMessage !== undefined) update.error_message = extras.errorMessage;
  if (extras?.qrCode !== undefined) update.qr_code = extras.qrCode;

  const { error } = await db
    .from('whatsapp_instances')
    .update(update)
    .eq('evolution_instance_name', instanceName);

  if (error) console.error(`[whatsapp-instances] Update failed for ${instanceName}:`, error.message);
}

/** Check if an account already has a working instance. */
export async function hasActiveInstance(accountId: string): Promise<boolean> {
  const { count, error } = await db
    .from('whatsapp_instances')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .in('status', ['connected', 'qr_ready']);

  if (error) return false;
  return (count ?? 0) > 0;
}
