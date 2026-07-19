/**
 * Evolution API helpers — drop-in replacement for Meta Cloud API when
 * WHATSAPP_PROVIDER=evolution.
 */

const EVOLUTION_BASE = process.env.EVOLUTION_API_URL || 'http://148.230.90.171:8096'
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'flujodigital'

function evoHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: EVOLUTION_KEY,
  }
}

export interface EvoSendResult {
  messageId: string
}

export async function evoSendText(
  to: string,
  text: string,
  contextMessageId?: string
): Promise<EvoSendResult> {
  const body: Record<string, unknown> = { number: to, text }
  if (contextMessageId) {
    body.quoted = { key: { id: contextMessageId } }
  }
  const res = await fetch(`${EVOLUTION_BASE}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return { messageId: data?.key?.id || '' }
}

export async function evoSendMedia(
  to: string,
  kind: string,
  link: string,
  caption?: string,
  filename?: string
): Promise<EvoSendResult> {
  const body: Record<string, unknown> = {
    number: to,
    mediatype: kind,
    media: link,
  }
  if (caption) body.caption = caption
  if (filename) body.fileName = filename
  const res = await fetch(`${EVOLUTION_BASE}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return { messageId: data?.key?.id || '' }
}
