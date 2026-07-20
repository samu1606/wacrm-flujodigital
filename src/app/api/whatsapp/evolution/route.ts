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

/**
 * Multi-tenant Evolution API webhook handler.
 * Routes incoming events to the correct account based on the instance name.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.json()

  // Extract event and instance from payload
  const event = (rawBody?.event || '').toLowerCase()
  let data = rawBody?.data || {}

  // Evolution v2.3.7 might spread message fields at top level
  if (Object.keys(data).length === 0 && rawBody?.key?.remoteJid) {
    data = rawBody
  }

  const instanceName = rawBody?.instance || ''
  const admin = supabaseAdmin()

  // ================================================================
  // Handle CONNECTION_UPDATE (status changes)
  // ================================================================
  if (event.includes('connection') || event.includes('qrcode') || event.includes('status')) {
    if (!instanceName) {
      return NextResponse.json({ status: 'ignored', reason: 'no_instance' })
    }

    // Update instance status in DB
    const status = data?.connectionStatus || data?.state || 'unknown'
    const mappedStatus = status === 'open' ? 'connected' :
                         status === 'connecting' ? 'qr_ready' :
                         status === 'close' ? 'disconnected' : 'pending'

    const { error: updErr } = await admin
      .from('whatsapp_instances')
      .update({
        status: mappedStatus,
        ...(data?.qrcode ? { qr_code: data.qrcode } : {}),
        ...(data?.ownerJid ? { owner_jid: data.ownerJid } : {}),
        ...(data?.profileName ? { profile_name: data.profileName } : {}),
        ...(rawBody?.ownerJid ? { owner_jid: rawBody.ownerJid } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('evolution_instance_name', instanceName)

    if (updErr) {
      console.error(`[evo] Status update error for ${instanceName}:`, updErr.message)
    }

    console.log(`[evo] Status update: ${instanceName} → ${mappedStatus}`)
    return NextResponse.json({ status: 'ok', instance: instanceName, newStatus: mappedStatus })
  }

  // ================================================================
  // Handle MESSAGE events
  // ================================================================
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

  // ================================================================
  // Multi-tenant routing: find account by instance name
  // ================================================================
  let accountId = '';
  let configUserId = '';

  if (instanceName) {
    // Look up the account for this Evolution instance
    const { data: inst } = await admin
      .from('whatsapp_instances')
      .select('account_id, evolution_instance_name')
      .eq('evolution_instance_name', instanceName)
      .single()

    if (inst?.account_id) {
      accountId = inst.account_id

      // Get first user of this account as config user
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, account_id')
        .eq('account_id', accountId)
        .limit(1)

      configUserId = profiles?.[0]?.id || ''
    }
  }

  // Fallback: use legacy hardcoded values for the admin instance
  if (!accountId) {
    console.warn('[evo] No account found for instance:', instanceName, '- using fallback')
    accountId = 'cefab3f3-574f-4f1b-b2e2-1436fa76f8dc'
    configUserId = 'bf2693ad-a969-44e5-91b5-dec62021a90c'
  }

  if (!configUserId) {
    console.error('[evo] No user found for account:', accountId)
    return NextResponse.json({ status: 'error', reason: 'no_user_for_account' }, { status: 500 })
  }

  return await processMessage(admin, data, event, accountId, configUserId, instanceName)
}

async function processMessage(
  admin: any,
  data: any,
  event: string,
  accountId: string,
  userId: string,
  instanceName: string,
) {
  const key = data?.key || {}
  const msg = data?.message || {}
  const remoteJid = (key.remoteJid || '').replace('@s.whatsapp.net', '')
  const phone = normalizePhone(remoteJid)
  const pushName = data?.pushName || 'WhatsApp Contact'
  const msgId = key.id || ''

  if (!phone && !msgId) {
    return NextResponse.json({ status: 'skipped', reason: 'no_phone_or_id' })
  }

  // Get or create contact (scoped to account)
  const { data: existingContacts } = await admin
    .from('contacts')
    .select('id, name')
    .eq('phone', phone)
    .eq('account_id', accountId)
    .limit(1)

  let contactId: string
  if (existingContacts && existingContacts.length > 0) {
    contactId = existingContacts[0].id
  } else {
    const { data: newContact, error: cErr } = await admin
      .from('contacts')
      .insert({ phone, name: pushName, account_id: accountId, user_id: userId })
      .select('id')
      .single()
    if (cErr) {
      console.error(`[evo] Contact insert error (${instanceName}):`, cErr.message)
      return NextResponse.json({ status: 'error', error: 'contact_insert: ' + cErr.message }, { status: 500 })
    }
    contactId = newContact.id
  }

  // Get or create conversation (scoped to account)
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
      .insert({ contact_id: contactId, account_id: accountId, user_id: userId })
      .select('id')
      .single()
    if (convErr) {
      console.error(`[evo] Conv insert error (${instanceName}):`, convErr.message)
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
    console.error(`[evo] Msg insert error (${instanceName}):`, msgErr.message)
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
    instance: instanceName,
    account: accountId,
    phone,
    msgType: contentType,
    contentLen: contentText.length,
    event,
  })
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[@s.whatsapp.net]/g, '').replace(/[^0-9]/g, '')
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
