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

const EVO_URL = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || 'http://evolution-saas:8080'
const EVO_KEY = process.env.EVOLUTION_API_KEY || ''

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
    const { data: inst } = await admin
      .from('whatsapp_instances')
      .select('account_id, evolution_instance_name')
      .eq('evolution_instance_name', instanceName)
      .single()

    if (inst?.account_id) {
      accountId = inst.account_id

      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, account_id')
        .eq('account_id', accountId)
        .limit(1)

      configUserId = profiles?.[0]?.user_id || ''
    }
  }

  if (!accountId) {
    console.warn('[evo] No account found for instance:', instanceName, '- using fallback')
    accountId = 'cefab3f3-574f-4f1b-b2e2-1436fa76f8dc'
    configUserId = 'bf2693ad-a969-44e5-91b5-dec62021a90c'
  }

  if (!configUserId) {
    console.error('[evo] No user found for account:', accountId)
    return NextResponse.json({ status: 'error', reason: 'no_user_for_account' }, { status: 500 })
  }

  return await processMessage(admin, data, rawBody, event, accountId, configUserId, instanceName)
}

// ================================================================
// Handle MESSAGE_EDIT — UPDATE existing message instead of INSERT
// ================================================================
async function handleMessageEdit(
  admin: any,
  msg: any,
  key: any,
  accountId: string,
  convId: string,
  instanceName: string,
  phone: string,
) {
  const protocolMsg = msg?.protocolMessage
  const editedMsg = protocolMsg?.editedMessage || msg?.editedMessage || msg?.messageContextInfo?.editedMessage

  // Extract new text from various possible locations
  const newText = editedMsg?.conversation
    || editedMsg?.extendedTextMessage?.text
    || editedMsg?.message?.conversation
    || editedMsg?.message?.extendedTextMessage?.text
    || msg?.message?.conversation
    || ''

  // The original message ID being edited — try several locations
  const originalMsgId = protocolMsg?.key?.id
    || msg?.message?.protocolMessage?.key?.id
    || msg?.messageContextInfo?.stanzaId
    || ''

  console.log(`[evo] ✏️ MESSAGE_EDIT detected | originalId=${originalMsgId.slice(0,12)} | newText=${newText.slice(0,80)} | instance=${instanceName}`)

  if (!newText || !originalMsgId) {
    return NextResponse.json({ status: 'ignored', reason: 'edit_no_text_or_id' })
  }

  // Find and update the original message
  const { data: existing, error: findErr } = await admin
    .from('messages')
    .select('id, content_text, conversation_id')
    .eq('message_id', originalMsgId)
    .limit(1)

  if (findErr || !existing || existing.length === 0) {
    console.warn(`[evo] ✏️ Edit target not found for msgId=${originalMsgId.slice(0,12)}`)
    return NextResponse.json({ status: 'ignored', reason: 'edit_target_not_found' })
  }

  const oldText = existing[0].content_text || ''

  const { error: updErr } = await admin
    .from('messages')
    .update({
      content_text: newText,
    })
    .eq('message_id', originalMsgId)

  // Try to set metadata if column exists
  if (!updErr) {
    try {
      await admin.from('messages').update({
        metadata: {
          edited: true,
          original_text: oldText,
          edited_at: new Date().toISOString(),
        }
      }).eq('message_id', originalMsgId)
    } catch { /* metadata column may not exist yet */ }
  }

  if (updErr) {
    console.error(`[evo] ✏️ Edit update failed:`, updErr.message)
    return NextResponse.json({ status: 'error', error: 'edit_update: ' + updErr.message }, { status: 500 })
  }

  // Update conversation's last_message_text to reflect the edit
  const msgConvId = existing[0]?.conversation_id || convId
  if (msgConvId) {
    await admin
      .from('conversations')
      .update({
        last_message_text: newText.length > 100 ? newText.slice(0, 97) + '...' : newText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', msgConvId)
  }

  return NextResponse.json({
    status: 'ok',
    action: 'message_edit',
    originalMsgId: originalMsgId.slice(0, 12),
    newTextLen: newText.length,
  })
}

async function processMessage(
  admin: any,
  data: any,
  rawBody: any,
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

  // ================================================================
  // EARLY CHECK: Message Edit (UPDATE, not INSERT)
  // ================================================================
  if (msg?.protocolMessage?.type === 'MESSAGE_EDIT') {
    return await handleMessageEdit(admin, msg, key, accountId, '', instanceName, phone)
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
  const metadata: any = {}

  if (msg.conversation) {
    contentText = msg.conversation
  } else if (msg.extendedTextMessage?.text) {
    contentText = msg.extendedTextMessage.text
  } else if (msg.imageMessage) {
    contentType = 'image'
    contentText = msg.imageMessage.caption || ''
    // Store WhatsApp CDN URL for immediate rendering; later re-fetch via media proxy
    mediaUrl = msg.imageMessage.url || null
    metadata.media = {
      type: 'image',
      url: msg.imageMessage.url,
      mimetype: msg.imageMessage.mimetype || 'image/jpeg',
      fileLength: msg.imageMessage.fileLength,
      mediaKey: msg.imageMessage.mediaKey,
      directPath: msg.imageMessage.directPath,
    }
  } else if (msg.videoMessage) {
    contentType = 'video'
    contentText = msg.videoMessage.caption || ''
    mediaUrl = msg.videoMessage.url || null
    metadata.media = {
      type: 'video',
      url: msg.videoMessage.url,
      mimetype: msg.videoMessage.mimetype || 'video/mp4',
      fileLength: msg.videoMessage.fileLength,
      mediaKey: msg.videoMessage.mediaKey,
      directPath: msg.videoMessage.directPath,
    }
  } else if (msg.audioMessage || msg.pttMessage) {
    const audioMsg = msg.audioMessage || msg.pttMessage
    contentType = 'audio'
    contentText = audioMsg.caption || ''
    mediaUrl = audioMsg.url || null
    metadata.media = {
      type: 'audio',
      url: audioMsg.url,
      mimetype: audioMsg.mimetype || 'audio/ogg; codecs=opus',
      fileLength: audioMsg.fileLength,
      mediaKey: audioMsg.mediaKey,
      directPath: audioMsg.directPath,
      seconds: audioMsg.seconds,
      ptt: !!msg.pttMessage,
    }
  } else if (msg.documentMessage) {
    contentType = 'document'
    contentText = msg.documentMessage.fileName || ''
    mediaUrl = msg.documentMessage.url || null
    metadata.media = {
      type: 'document',
      url: msg.documentMessage.url,
      mimetype: msg.documentMessage.mimetype || 'application/octet-stream',
      fileName: msg.documentMessage.fileName,
      fileLength: msg.documentMessage.fileLength,
      mediaKey: msg.documentMessage.mediaKey,
      directPath: msg.documentMessage.directPath,
    }
  } else if (msg.stickerMessage) {
    contentType = 'image'
    contentText = '📱 Sticker'
    mediaUrl = msg.stickerMessage.url || null
    metadata.media = { type: 'sticker', url: msg.stickerMessage.url }
  } else if (msg.locationMessage) {
    contentType = 'text'
    contentText = '📍 Ubicación compartida'
    metadata.location = {
      lat: msg.locationMessage.degreesLatitude,
      lng: msg.locationMessage.degreesLongitude,
      name: msg.locationMessage.name,
      address: msg.locationMessage.address,
    }
  } else if (msg.contactMessage) {
    contentType = 'text'
    contentText = `👤 Contacto: ${msg.contactMessage?.displayName || ''}`
    metadata.contact = {
      displayName: msg.contactMessage?.displayName,
      vcard: msg.contactMessage?.vcard,
    }
  } else if (msg.buttonsResponseMessage) {
    contentText = msg.buttonsResponseMessage?.selectedDisplayText || 'Botón seleccionado'
  } else if (msg.listResponseMessage) {
    contentText = msg.listResponseMessage?.title || 'Lista seleccionada'
  } else if (msg.reactionMessage) {
    contentText = msg.reactionMessage?.text || '👍'
    contentType = 'text'
  } else if (msg.protocolMessage) {
    // Non-edit protocol messages (REVOKE, etc.)
    const pType = msg.protocolMessage.type
    console.log(`[evo] Protocol message: ${pType} ignored`)
    return NextResponse.json({ status: 'ignored', reason: `protocol_${pType}` })
  } else if (msg.ephemeralMessage) {
    contentText = msg.ephemeralMessage?.message?.conversation || ''
  } else if (msg.viewOnceMessage) {
    const inner = msg.viewOnceMessage?.message
    if (inner?.imageMessage) {
      contentType = 'image'
      contentText = '📷 View Once'
      mediaUrl = inner.imageMessage.url || null
      metadata.media = { type: 'image', url: inner.imageMessage.url, viewOnce: true }
    } else if (inner?.videoMessage) {
      contentType = 'video'
      contentText = '🎬 View Once'
      mediaUrl = inner.videoMessage.url || null
      metadata.media = { type: 'video', url: inner.videoMessage.url, viewOnce: true }
    } else {
      contentText = '📩 View Once'
    }
  // Handle edited messages arriving in alternative formats
  } else if (msg.editedMessage || (msg.messageContextInfo && msg.messageContextInfo.editedMessage)) {
    // Evolution sometimes sends edits as editedMessage at top level
    // or nested inside messageContextInfo
    return await handleMessageEdit(admin, msg, key, accountId, convId, instanceName, phone)
  } else {
    contentText = '[tipo: ' + Object.keys(msg).join(',') + ']'
    metadata.unknownType = Object.keys(msg)
  }

  if (!contentText && !mediaUrl) {
    return NextResponse.json({ status: 'skipped', reason: 'empty_content' })
  }

  // Insert message — metadata is stored separately in case column doesn't exist yet (migration 018)
  const { data: newMsg, error: msgErr } = await admin
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
    .select('id')
    .single()

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

  // Try to store metadata (silently fails if column doesn't exist yet)
  if (Object.keys(metadata).length > 0 && newMsg?.id) {
    try {
      await admin.from('messages').update({ metadata }).eq('id', newMsg.id)
    } catch { /* metadata column may not exist yet */ }
  }

  // ================================================================
  // For media messages: fire-and-forget fetch base64 from Evolution
  // to make media permanently available (WhatsApp CDN URLs expire)
  // ================================================================
  if ((contentType === 'image' || contentType === 'video' || contentType === 'audio' || contentType === 'document') && mediaUrl && newMsg?.id) {
    fetchMediaBase64InBackground(newMsg.id, instanceName, rawBody)
  }

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

// ================================================================
// Background media download: fetch base64 from Evolution API
// and update the stored message with a persistent data URL
// ================================================================
async function fetchMediaBase64InBackground(messageId: string, instanceName: string, rawPayload: any) {
  try {
    if (!EVO_URL || !EVO_KEY || !instanceName) {
      console.warn(`[evo] 📎 Cannot fetch media — missing EVO_URL/EVO_KEY or instance`)
      return
    }

    const msg = rawPayload?.data?.message || rawPayload?.message || {}

    // Determine mimetype from message type
    let mimetype = 'image/jpeg'
    if (msg.imageMessage) mimetype = msg.imageMessage.mimetype || 'image/jpeg'
    else if (msg.videoMessage) mimetype = msg.videoMessage.mimetype || 'video/mp4'
    else if (msg.audioMessage || msg.pttMessage) {
      mimetype = (msg.audioMessage || msg.pttMessage).mimetype || 'audio/ogg; codecs=opus'
    }
    else {
      console.warn(`[evo] 📎 Unknown media type for msg ${messageId.slice(0,8)}`)
      return
    }

    console.log(`[evo] 📎 Fetching base64 media for msg ${messageId.slice(0,8)} from ${instanceName}`)

    const resp = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
      },
      body: JSON.stringify({
        message: {
          key: rawPayload?.data?.key || rawPayload?.key || {},
          message: msg,
        },
      }),
    })

    if (!resp.ok) {
      console.warn(`[evo] 📎 Evolution media fetch failed: HTTP ${resp.status}`)
      return
    }

    const result = await resp.json()
    const base64 = result?.base64 || result?.data?.base64 || ''

    if (!base64) {
      console.warn(`[evo] 📎 No base64 in Evolution response for msg ${messageId.slice(0,8)}`)
      return
    }

    // Build data URL
    const dataUrl = `data:${mimetype};base64,${base64}`

    // Update the message with the persistent data URL
    const admin = supabaseAdmin()
    
    // Get existing metadata to preserve
    const { data: existingMsg } = await admin
      .from('messages')
      .select('metadata')
      .eq('id', messageId)
      .single()
    
    const mergedMetadata = { ...(existingMsg?.metadata || {}), base64_fetched: true }
    
    const { error } = await admin
      .from('messages')
      .update({
        media_url: dataUrl,
        metadata: mergedMetadata,
      })
      .eq('id', messageId)

    if (error) {
      console.error(`[evo] 📎 Failed to update media_url for msg ${messageId.slice(0,8)}:`, error.message)
    } else {
      console.log(`[evo] 📎 Media base64 stored for msg ${messageId.slice(0,8)} (${Math.round(base64.length/1024)}KB)`)
    }
  } catch (err: any) {
    console.error(`[evo] 📎 Media fetch error for msg ${messageId.slice(0,8)}:`, err.message)
  }
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/[@s.whatsapp.net]/g, '').replace(/[^0-9]/g, '')
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
