/**
 * Wompi Payment Gateway — Colombia
 * Sandbox: https://sandbox.wompi.co/v1
 * Production: https://production.wompi.co/v1
 *
 * Env vars needed:
 *   WOMPI_PRIVATE_KEY   — prv_... or sk_... for production
 *   WOMPI_PUBLIC_KEY    — pk_... (for frontend)
 *   WOMPI_EVENTS_KEY    — for webhook signature verification
 *   WOMPI_SANDBOX       — "true" for test mode, "false" for production
 */

import { createHmac } from 'crypto';

function isSandbox(): boolean {
  // Use NEXT_PUBLIC_ prefix for client-accessible env
  const sandbox = process.env.WOMPI_SANDBOX || process.env.NEXT_PUBLIC_WOMPI_SANDBOX || 'true';
  return sandbox === 'true';
}

function wompiKey(): string {
  return process.env.WOMPI_PRIVATE_KEY || '';
}

function eventsKey(): string {
  // For security, events_key is ONLY server-side (no NEXT_PUBLIC_ prefix)
  return process.env.WOMPI_EVENTS_KEY || '';
}

function wompiBase(): string {
  return isSandbox()
    ? 'https://sandbox.wompi.co/v1'
    : 'https://production.wompi.co/v1';
}

function wompiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${wompiKey()}`,
  };
}

export interface WompiTransaction {
  id: string;
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  payment_method_type?: string;
  created_at: string;
  finalized_at?: string;
}

/**
 * Create a one-time payment link.
 * Returns the redirect URL to Wompi's hosted checkout page.
 */
export async function createWompiTransaction(params: {
  amountInCents: number;
  currency?: string;
  customerEmail: string;
  reference: string;
  returnUrl: string;
}): Promise<{ id: string; redirectUrl: string; reference: string }> {
  const body = {
    amount_in_cents: params.amountInCents,
    currency: params.currency || 'COP',
    customer_email: params.customerEmail,
    reference: params.reference,
    redirect_url: params.returnUrl,
  };

  const res = await fetch(`${wompiBase()}/transactions`, {
    method: 'POST',
    headers: wompiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wompi create error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const tx = data?.data || data;

  return {
    id: tx.id,
    redirectUrl: tx.redirect_url || '',
    reference: tx.reference,
  };
}

/**
 * Verify a payment by transaction ID.
 */
export async function getWompiTransaction(
  transactionId: string
): Promise<WompiTransaction | null> {
  const res = await fetch(`${wompiBase()}/transactions/${transactionId}`, {
    headers: wompiHeaders(),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data?.data || null;
}

/**
 * Verify Wompi webhook signature.
 * Wompi sends x-event-checksum = HMAC-SHA256(body, events_key).
 */
export function verifyWompiSignature(rawBody: string, checksum: string): boolean {
  const key = eventsKey();
  if (!key) {
    console.warn('[wompi] WOMPI_EVENTS_KEY not set — skipping signature verification');
    return true;
  }

  const computed = createHmac('sha256', key).update(rawBody).digest('hex');

  // Timing-safe comparison
  if (computed.length !== checksum.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ checksum.charCodeAt(i);
  }
  return diff === 0;
}

export { isSandbox, wompiBase };
