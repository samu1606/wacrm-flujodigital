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
  
  // Normalize: some versions send event name directly without data wrapper
  let data = rawBody?.data || {}
  
  // If data has the message structure directly (e.g., evolution v2.3.7 
  // might spread message fields at top level instead of nesting under data)
  if (Object.keys(data).length === 0 && rawBody?.key?.remoteJid) {
    data = rawBody
  }
  
  const instance = rawBody?.instance || 'flujodigital'

  // Accept ALL message-related events
  const isMessageEvent = event.includes('message') || 
                         event.includes('upsert') || 
                         data?.key?.remoteJid

  if (!isMessageEvent) {
    return NextResponse.json({ status: 'ok', event, reason: 'not_message_event' })
  }

  // Ignore truly outbound messages
  if (data?.key?.fromMe === true) {
    return NextResponse.json({ status: 'ignored', reason: 'outbound' })
  }

  return await processMessage(data, event)
}

async function processMessage(data: any, event: string) {
  const ACCOUNT_ID = 'cefab3f3-574f-4f1b-b2e2-1436fa76f8dc'
  const CONFIG_USER_ID = 'bf2693ad-a969-44e5-91b5-dec62021a90c'

  const admin = supabaseAdmin()
  const key = data?.key || {}
  const msg = data?.message || {}
  const remoteJid = (key.remoteJid || '').replace('@s.whatsapp.net', '')
  const phone = normalizePhone(remoteJid)
  const pushName = data?.pushName || 'WhatsApp Contact'
  const msgId = key.id || ''

  if (!phone && !msgId) {
    return NextResponse.json({ status: 'skipped', reason: 'no_phone_or_id' })
  }

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
    if (cErr) {
      console.error('[evo] Contact insert error:', cErr)
      return NextResponse.json({ status: 'error', error: 'contact_insert: ' + cErr.message }, { status: 500 })
    }
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
    if (convErr) {
      console.error('[evo] Conv insert error:', convErr)
      return NextResponse.json({ status: 'error', error: 'conv_insert: ' + convErr.message }, { status: 500 })
    }
    convId = newConv.id
    unreadCount = 1
  }

  // Build message content
  let contentType = 'text'
  let contentText = ''
  let mediaUrl: string | null = null

  if (msg.conversation) {
    contentText = msg.conversation
  } else if (msg.extendedTextMessage?.text) {
    contentText = msg.extendedTextMessage.text
  } else if (msg.imageMessage) {
    contentType = 'image'
    contentText = msg.imageMessage.caption || ''
    mediaUrl = msg.imageMessage.url || null
  } else if (msg.videoMessage) {
    contentType = 'video'
    contentText = msg.videoMessage.caption || ''
    mediaUrl = msg.videoMessage.url || null
  } else if (msg.audioMessage) {
    contentType = 'audio'
  } else if (msg.documentMessage) {
    contentType = 'document'
    contentText = msg.documentMessage.fileName || ''
    mediaUrl = msg.documentMessage.url || null
  } else if (msg.stickerMessage) {
    contentType = 'image'
    contentText = '📱 Sticker'
  } else if (msg.locationMessage) {
    contentType = 'text'
    contentText = '📍 Ubicación'
  } else if (msg.contactMessage) {
    contentType = 'text'
    contentText = '👤 Contacto'
  } else if (msg.buttonsResponseMessage) {
    contentText = msg.buttonsResponseMessage?.selectedDisplayText || 'Botón seleccionado'
  } else if (msg.listResponseMessage) {
    contentText = msg.listResponseMessage?.title || 'Lista seleccionada'
  } else if (msg.reactionMessage) {
    contentText = msg.reactionMessage?.text || '👍 Reaction'
  } else if (msg.protocolMessage) {
    // System messages like message deleted, etc.
    return NextResponse.json({ status: 'ignored', reason: 'protocol_message' })
  } else if (msg.ephemeralMessage) {
    contentText = msg.ephemeralMessage?.message?.conversation || ''
  } else if (msg.viewOnceMessage) {
    const inner = msg.viewOnceMessage?.message
    if (inner?.imageMessage) {
      contentType = 'image'
      contentText = '📷 View Once'
      mediaUrl = inner.imageMessage.url || null
    } else if (inner?.videoMessage) {
      contentType = 'video'
      contentText = '🎬 View Once'
      mediaUrl = inner.videoMessage.url || null
    } else {
      contentText = '📩 View Once message'
    }
  } else {
    // Unknown message type — log the keys for debugging
    contentText = '[tipo: ' + Object.keys(msg).join(',') + ']'
  }

  if (!contentText && !mediaUrl) {
    return NextResponse.json({ status: 'skipped', reason: 'empty_content' })
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

  if (msgErr) {
    console.error('[evo] Msg insert error:', msgErr)
    return NextResponse.json({ status: 'error', error: 'msg_insert: ' + msgErr.message }, { status: 500 })
  }

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

  return NextResponse.json({ 
    status: 'ok', 
    phone, 
    msgType: contentType, 
    contentLen: contentText.length,
    event
  })
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[@s.whatsapp.net]/g, '').replace(/[^0-9]/g, '')
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
