/**
 * Evolution API instance manager — multi-tenant support.
 * Creates, fetches, and deletes Evolution instances per account.
 */

const EVO_BASE = process.env.EVOLUTION_API_URL || 'http://evolution-saas:8080';
const EVO_KEY = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY || '';

function evoHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: EVO_KEY,
  };
}

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: 'open' | 'connecting' | 'close';
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  number?: string | null;
  integration: string;
  token: string;
}

export interface EvoCreateResult {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  qrcode?: {
    code: string;
    base64: string;
  };
}

/**
 * Create a new Evolution instance for a customer account.
 * Instance names should be unique per account.
 * Note: Evolution v2.3.7 rejects webhook params during creation (401).
 * Use setInstanceWebhook() separately after creation.
 *
 * Returns the decoded result with qrCodeBase64 for easy consumption.
 */
export async function createEvolutionInstance(
  instanceName: string
): Promise<EvoCreateResult & { qrCodeBase64?: string }> {
  const res = await fetch(`${EVO_BASE}/instance/create`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify({
      instanceName,
      token: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution create error ${res.status}: ${err}`);
  }

  const data = await res.json();
  // Extract base64 QR from Evolution response
  const qrCodeBase64 = data?.qrcode?.base64 || null;
  return { ...data, qrCodeBase64 };
}

/**
 * Set webhook for an Evolution instance (called after creation).
 */
export async function setInstanceWebhook(
  instanceName: string,
  webhookUrl: string
): Promise<boolean> {
  const res = await fetch(`${EVO_BASE}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: true,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      },
    }),
  });

  if (!res.ok) {
    console.error(`[evo-manager] Webhook set error for ${instanceName}: ${res.status}`);
    return false;
  }
  return true;
}

/**
 * Get QR code for an existing instance.
 * Returns base64 QR image and pairing code.
 */
export async function getInstanceQR(
  instanceName: string
): Promise<{ qrCode: string | null; qrBase64: string | null; pairingCode: string | null }> {
  try {
    const res = await fetch(`${EVO_BASE}/instance/connect/${instanceName}`, {
      headers: { ...evoHeaders(), cache: 'no-store' },
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 400 || res.status === 404) {
        return { qrCode: null, qrBase64: null, pairingCode: null };
      }
      throw new Error(`Evolution connect error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      qrCode: data?.code || data?.qrcode?.code || null,
      qrBase64: data?.base64 || data?.qrcode?.base64 || null,
      pairingCode: data?.pairingCode || null,
    };
  } catch (err) {
    console.error('[evo-manager] QR fetch error:', err);
    return { qrCode: null, qrBase64: null, pairingCode: null };
  }
}

/**
 * Fetch an instance's current state from Evolution API.
 */
export async function fetchInstance(
  instanceName: string
): Promise<EvolutionInstance | null> {
  const res = await fetch(`${EVO_BASE}/instance/fetchInstances`, {
    headers: { ...evoHeaders(), cache: 'no-store' },
  });

  if (!res.ok) return null;

  const instances: EvolutionInstance[] = await res.json();
  return instances.find((i) => i.name === instanceName) || null;
}

/**
 * Delete an Evolution instance.
 */
export async function deleteEvolutionInstance(
  instanceName: string
): Promise<boolean> {
  const res = await fetch(`${EVO_BASE}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: evoHeaders(),
  });

  return res.ok || res.status === 404;
}

/**
 * Logout (disconnect) an Evolution instance without deleting it.
 */
export async function logoutInstance(
  instanceName: string
): Promise<boolean> {
  const res = await fetch(`${EVO_BASE}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: evoHeaders(),
  });

  return res.ok;
}

/**
 * Send text message through a specific Evolution instance.
 */
export async function evoSendTextByInstance(
  instanceName: string,
  to: string,
  text: string,
  contextMessageId?: string
): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = { number: to, text };
  if (contextMessageId) {
    body.quoted = { key: { id: contextMessageId } };
  }

  const res = await fetch(`${EVO_BASE}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution send error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { messageId: data?.key?.id || '' };
}

/**
 * Send media through a specific Evolution instance.
 */
export async function evoSendMediaByInstance(
  instanceName: string,
  to: string,
  kind: string,
  link: string,
  caption?: string,
  filename?: string
): Promise<{ messageId: string }> {
  const body: Record<string, unknown> = {
    number: to,
    mediatype: kind,
    media: link,
  };
  if (caption) body.caption = caption;
  if (filename) body.fileName = filename;

  const res = await fetch(`${EVO_BASE}/message/sendMedia/${instanceName}`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution send error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { messageId: data?.key?.id || '' };
}

export { EVO_BASE, EVO_KEY };
