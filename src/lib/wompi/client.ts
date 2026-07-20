/**
 * Wompi Payment Gateway — Colombia (Production)
 * API: https://production.wompi.co/v1
 *
 * Env vars needed:
 *   WOMPI_PRIVATE_KEY   — prv_prod_... 
 *   WOMPI_PUBLIC_KEY    — pub_prod_...
 *   WOMPI_EVENTS_KEY    — prod_events_...
 */

import { createHmac } from 'crypto';

const WOMPI_BASE = 'https://production.wompi.co/v1';

function privateKey(): string {
  return process.env.WOMPI_PRIVATE_KEY || '';
}

function publicKey(): string {
  return process.env.WOMPI_PUBLIC_KEY || '';
}

function eventsKey(): string {
  return process.env.WOMPI_EVENTS_KEY || '';
}

function wompiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${privateKey()}`,
  };
}

/** Cached merchant acceptance tokens */
let _acceptanceToken = '';
let _personalDataToken = '';

async function getAcceptanceTokens() {
  if (_acceptanceToken) return { acceptanceToken: _acceptanceToken, personalDataToken: _personalDataToken };

  const res = await fetch(`${WOMPI_BASE}/merchants/${publicKey()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wompi merchant lookup failed ${res.status}: ${err}`);
  }

  const data = await res.json();
  const merchant = data?.data || data;

  _acceptanceToken = merchant?.presigned_acceptance?.acceptance_token || '';
  _personalDataToken = merchant?.presigned_personal_data_auth?.acceptance_token || '';

  return { acceptanceToken: _acceptanceToken, personalDataToken: _personalDataToken };
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
 * Create a Wompi checkout link for a payment.
 * Returns the redirect URL to Wompi's hosted checkout page.
 */
export async function createWompiTransaction(params: {
  amountInCents: number;
  currency?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  reference: string;
  returnUrl: string;
}): Promise<{ id: string; redirectUrl: string; reference: string }> {
  // Get fresh acceptance tokens
  const { acceptanceToken, personalDataToken } = await getAcceptanceTokens();

  const body: Record<string, unknown> = {
    amount_in_cents: params.amountInCents,
    currency: params.currency || 'COP',
    customer_email: params.customerEmail,
    reference: params.reference,
    redirect_url: params.returnUrl,
    acceptance_token: acceptanceToken,
    accept_personal_auth: personalDataToken,
    customer_data: {
      phone_number: params.customerPhone || '',
      full_name: params.customerName || '',
    },
    // Let Wompi show all available payment methods (Nequi, PSE, cards, etc.)
    payment_method: {
      type: 'CARD', // This triggers Wompi's hosted checkout with ALL methods
      installments: 1,
    },
  };

  const res = await fetch(`${WOMPI_BASE}/transactions`, {
    method: 'POST',
    headers: wompiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wompi error ${res.status}: ${err}`);
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
  const res = await fetch(`${WOMPI_BASE}/transactions/${transactionId}`, {
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

  if (computed.length !== checksum.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ checksum.charCodeAt(i);
  }
  return diff === 0;
}

export { WOMPI_BASE };
