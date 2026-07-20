import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const event = (body?.event || '').toLowerCase()
  const data = body?.data || {}
  const instance = body?.instance || 'flujodigital'

  // Ignore outbound messages
  if (data?.key?.fromMe) {
    return NextResponse.json({ status: 'ignored', reason: 'outbound' })
  }

  if (!['messages.upsert', 'messages.update'].includes(event)) {
    return NextResponse.json({ status: 'ok', event })
  }

  // Try the Meta handler first (existing webhook pipeline)
  const metaPayload = buildMetaPayload(body, instance)
  const metaUrl = new URL('/api/whatsapp/webhook', request.url)

  try {
    const metaRes = await fetch(metaUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-evolution-bridge': 'true' },
      body: JSON.stringify(metaPayload),
    })
    if (metaRes.ok) {
      return NextResponse.json({ status: 'forwarded', wacrmStatus: metaRes.status })
    }
    console.warn('[evo] Meta handler returned', metaRes.status, '— falling back to direct insert')
  } catch (e) {
    console.warn('[evo] Meta handler unreachable, direct insert:', e)
  }

  // Fallback: direct DB insert
  try {
    await directInsert(data)
    return NextResponse.json({ status: 'direct_insert' })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', error: e.message }, { status: 500 })
  }
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[@s.whatsapp.net]/g, '').replace(/[^0-9]/g, '')
}

async function directInsert(data: any) {
  const admin = supabaseAdmin()
  const key = data?.key || {}
  const msg = data?.message || {}
  const remoteJid = (key.remoteJid || '').replace('@s.whatsapp.net', '')
  const phone = normalizePhone(remoteJid)
  const pushName = data?.pushName || 'WhatsApp Contact'
  const msgId = key.id || ''

  // Get or create contact
  const { data: existingContacts } = await admin
    .from('contacts')
    .select('id, name')
    .eq('phone', phone)
    .limit(1)

  let contactId: string
  if (existingContacts && existingContacts.length > 0) {
    contactId = existingContacts[0].id
  } else {
    const { data: newContact, error: cErr } = await admin
      .from('contacts')
      .insert({ phone, name: pushName })
      .select('id')
      .single()
    if (cErr) throw new Error(`Contact insert: ${cErr.message}`)
    contactId = newContact.id
  }

  // Get or create conversation
  const { data: existingConvs } = await admin
    .from('conversations')
    .select('id, unread_count')
    .eq('contact_id', contactId)
    .limit(1)

  let convId: string
  let unreadCount = 0
  if (existingConvs && existingConvs.length > 0) {
    convId = existingConvs[0].id
    unreadCount = (existingConvs[0].unread_count || 0) + 1
  } else {
    const { data: newConv, error: convErr } = await admin
      .from('conversations')
      .insert({ contact_id: contactId })
      .select('id')
      .single()
    if (convErr) throw new Error(`Conversation insert: ${convErr.message}`)
    convId = newConv.id
    unreadCount = 1
  }

  // Build message content
  let contentType = 'text'
  let contentText = ''
  let mediaUrl: string | null = null

  if ('conversation' in msg) {
    contentText = msg.conversation || ''
  } else if ('extendedTextMessage' in msg) {
    contentText = msg.extendedTextMessage?.text || ''
  } else if ('imageMessage' in msg) {
    contentType = 'image'
    contentText = msg.imageMessage?.caption || ''
    mediaUrl = msg.imageMessage?.url || null
  } else if ('videoMessage' in msg) {
    contentType = 'video'
    contentText = msg.videoMessage?.caption || ''
    mediaUrl = msg.videoMessage?.url || null
  } else if ('audioMessage' in msg) {
    contentType = 'audio'
  } else if ('documentMessage' in msg) {
    contentType = 'document'
    contentText = msg.documentMessage?.fileName || ''
    mediaUrl = msg.documentMessage?.url || null
  } else {
    contentText = JSON.stringify(msg).substring(0, 1000)
  }

  // Insert message
  const { error: msgErr } = await admin
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_type: 'customer',
      content_type: contentType,
      content_text: contentText,
      media_url: mediaUrl,
      message_id: msgId,
      status: 'delivered',
    })

  if (msgErr) throw new Error(`Message insert: ${msgErr.message}`)

  // Update conversation
  await admin
    .from('conversations')
    .update({
      last_message_text: contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      unread_count: unreadCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', convId)
}

function buildMetaPayload(body: any, instance: string) {
  const data = body?.data || {}
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

  return {
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
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
