import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const event = body?.event || ''
  const data = body?.data || {}
  const instance = body?.instance || 'flujodigital'

  if (data?.key?.fromMe) {
    return NextResponse.json({ status: 'ignored', reason: 'outbound' })
  }

  const normalizedEvent = event?.toLowerCase() || ''
  if (!['messages.upsert', 'messages.update'].includes(normalizedEvent)) {
    return NextResponse.json({ status: 'ok', event })
  }

  const key = data?.key || {}
  const msg = data?.message || {}
  const remoteJid = (key.remoteJid || '').replace('@s.whatsapp.net', '')
  const pushName = data?.pushName || 'Contact'

  let msgType = 'text'
  let msgContent: Record<string, unknown> = {}

  if ('conversation' in msg) {
    msgContent = { body: msg.conversation }
  } else if ('imageMessage' in msg) {
    msgType = 'image'
    msgContent = { id: msg.imageMessage?.url || '' }
  } else if ('videoMessage' in msg) {
    msgType = 'video'
    msgContent = { id: msg.videoMessage?.url || '' }
  } else if ('audioMessage' in msg) {
    msgType = 'audio'
    msgContent = { id: msg.audioMessage?.url || '' }
  } else if ('documentMessage' in msg) {
    msgType = 'document'
    msgContent = { id: msg.documentMessage?.url || '', filename: msg.documentMessage?.fileName || '' }
  } else {
    msgContent = { body: JSON.stringify(msg).substring(0, 1000) }
  }

  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: instance,
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: remoteJid, phone_number_id: instance },
          contacts: [{ profile: { name: pushName }, wa_id: remoteJid }],
          messages: [{
            from: remoteJid,
            id: key.id || '',
            timestamp: String(data?.messageTimestamp || ''),
            type: msgType,
            [msgType]: msgContent,
          }],
        },
      }],
    }],
  }

  const webhookUrl = new URL('/api/whatsapp/webhook', request.url)
  try {
    const res = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-evolution-bridge': 'true' },
      body: JSON.stringify(metaPayload),
    })
    return NextResponse.json({ status: 'forwarded', wacrmStatus: res.status })
  } catch (e) {
    return NextResponse.json({ status: 'error', error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
