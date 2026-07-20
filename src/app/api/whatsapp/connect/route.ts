/**
 * POST /api/whatsapp/connect — Create a new Evolution instance for the current account and return QR.
 * GET  /api/whatsapp/connect — Get current connection status.
 * DELETE /api/whatsapp/connect — Disconnect/delete the current instance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createEvolutionInstance,
  getInstanceQR,
  fetchInstance,
  deleteEvolutionInstance,
  setInstanceWebhook,
} from '@/lib/whatsapp/evo-manager';
import {
  getAnyAccountInstance,
  upsertInstance,
  updateInstanceStatus,
} from '@/lib/whatsapp/whatsapp-instances';

function getWebhookUrl(): string {
  const base = process.env.WACRM_BASE_URL || 'http://148.230.90.171:8095';
  return `${base}/api/whatsapp/evolution`;
}

/** Create a new WhatsApp instance for the current account and return QR. */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's account — profiles uses user_id FK to auth.users
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const accountId = profile.account_id;

    // Check if already has an instance
    const existing = await getAnyAccountInstance(accountId);
    if (existing) {
      if (existing.status === 'connected') {
        return NextResponse.json({
          status: 'connected',
          instanceName: existing.evolution_instance_name,
          phoneNumber: existing.phone_number,
          profileName: existing.profile_name,
        });
      }
      if (existing.status === 'qr_ready' && existing.qr_code) {
        return NextResponse.json({
          status: 'qr_ready',
          instanceName: existing.evolution_instance_name,
          qrCode: existing.qr_code,
        });
      }
      // Delete stale instance and recreate
      await deleteEvolutionInstance(existing.evolution_instance_name).catch(() => {});
    }

    // Generate unique instance name
    const accountSlug = accountId.replace(/-/g, '').slice(0, 8);
    const instanceName = `wasapea-${accountSlug}`;

    console.log(`[whatsapp/connect] Creating Evolution instance: ${instanceName}`);

    // Create Evolution instance (no webhook — Evolution v2.3.7 rejects webhook params during creation)
    const evolutionResult = await createEvolutionInstance(instanceName);

    // Set webhook after creation (Evolution v2.3.7 workaround)
    const webhookUrl = getWebhookUrl();
    setInstanceWebhook(instanceName, webhookUrl).catch((e) => {
      console.error('[whatsapp/connect] Webhook setup error:', e);
    });

    // Store in DB with QR from creation response
    const qrBase64 = evolutionResult?.qrCodeBase64 || null;
    await upsertInstance({
      accountId,
      instanceName,
      evolutionInstanceId: evolutionResult?.instance?.instanceId,
      status: 'qr_ready',
      qrCode: qrBase64,
    });

    // Also try fetching QR from connect endpoint (some Evolution versions)
    if (!qrBase64) {
      const qr = await getInstanceQR(instanceName);
      if (qr.qrBase64) {
        await updateInstanceStatus(instanceName, 'qr_ready', { qrCode: qr.qrBase64 });
      }
    }

    return NextResponse.json({
      status: 'qr_ready',
      instanceName,
      qrCode: qrBase64,
    });
  } catch (err) {
    console.error('[whatsapp/connect] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to create WhatsApp instance', detail: String(err) },
      { status: 500 }
    );
  }
}

/** Get current connection status. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ status: 'no_account' });
    }

    const instance = await getAnyAccountInstance(profile.account_id);
    if (!instance) {
      return NextResponse.json({ status: 'not_connected' });
    }

    // If connected, fetch latest info from Evolution
    if (instance.status === 'connected') {
      try {
        const evoInstance = await fetchInstance(instance.evolution_instance_name);
        if (evoInstance && evoInstance.connectionStatus === 'open') {
          if (
            evoInstance.profileName !== instance.profile_name ||
            evoInstance.ownerJid !== instance.owner_jid
          ) {
            await updateInstanceStatus(instance.evolution_instance_name, 'connected', {
              profileName: evoInstance.profileName,
              ownerJid: evoInstance.ownerJid,
              phoneNumber: evoInstance.number || undefined,
            });
          }
        }
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      status: instance.status,
      instanceName: instance.evolution_instance_name,
      phoneNumber: instance.phone_number,
      profileName: instance.profile_name,
      qrCode: instance.qr_code,
      errorMessage: instance.error_message,
    });
  } catch (err) {
    console.error('[whatsapp/connect] Status error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Disconnect and delete the instance. */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 400 });
    }

    const instance = await getAnyAccountInstance(profile.account_id);
    if (!instance) {
      return NextResponse.json({ status: 'not_connected' });
    }

    // Delete from Evolution
    try {
      await deleteEvolutionInstance(instance.evolution_instance_name);
    } catch (err) {
      console.error('[whatsapp/connect] Evolution delete error:', err);
    }

    // Mark as disconnected in DB
    await updateInstanceStatus(instance.evolution_instance_name, 'disconnected');

    return NextResponse.json({ status: 'disconnected' });
  } catch (err) {
    console.error('[whatsapp/connect] Disconnect error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
