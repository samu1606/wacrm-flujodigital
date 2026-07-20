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
  const rawBody = await request.json()
  const event = (rawBody?.event || '').toLowerCase()
  const data = rawBody?.data || {}
  const instance = rawBody?.instance || 'flujodigital'

  // DEBUG: Store raw webhook payload for debugging
  if (event === 'messages.upsert' || event === 'messages.update') {
    try {
      await debugStore(rawBody, event)
    } catch (_) {}
  }

  // Ignore outbound messages
  if (data?.key?.fromMe) {
    return NextResponse.json({ status: 'ignored', reason: 'outbound' })
  }

  if (!['messages.upsert', 'messages.update'].includes(event)) {
    return NextResponse.json({ status: 'ok', event })
  }

  // Direct DB insert
  try {
    await directInsert(data)
    return NextResponse.json({ status: 'direct_insert' })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', error: e.message }, { status: 500 })
  }
}

// DEBUG: store raw webhook in Supabase
async function debugStore(raw: any, event: string) {
  const admin = supabaseAdmin()
  const data = raw?.data || {}
  const key = data?.key || {}
  const msg = data?.message || {}
  const msgId = key.id || 'DEBUG-' + Date.now()
  const summary = JSON.stringify({
    event,
    fromMe: key.fromMe,
    remoteJid: key.remoteJid,
    messageType: data.messageType,
    messageKeys: Object.keys(msg),
    pushName: data.pushName,
    dataKeys: Object.keys(data),
    rawKeys: Object.keys(raw),
  })
  await admin.from('messages').insert({
    message_id: msgId + '-DEBUG',
    content_text: summary,
    content_type: 'text',
    sender_type: 'system',
    status: 'delivered',
    conversation_id: '162a3736-8e45-48fb-ada9-36f4f4a3c005', // Edwin's conversation
  })
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[@s.whatsapp.net]/g, '').replace(/[^0-9]/g, '')
}

async function directInsert(data: any) {
  const ACCOUNT_ID = 'cefab3f3-574f-4f1b-b2e2-1436fa76f8dc'
  const CONFIG_USER_ID = 'bf2693ad-a969-44e5-91b5-dec62021a90c'

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
      .insert({ phone, name: pushName, account_id: ACCOUNT_ID, user_id: CONFIG_USER_ID })
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
      .insert({ contact_id: contactId, account_id: ACCOUNT_ID, user_id: CONFIG_USER_ID })
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

// Unused but kept for reference
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
