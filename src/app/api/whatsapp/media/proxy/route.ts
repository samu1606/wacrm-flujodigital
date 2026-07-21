import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const messageId = request.nextUrl.searchParams.get('id')
  if (!messageId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get the message to find its metadata (contains Evolution media info)
  const { data: msg } = await admin
    .from('messages')
    .select('metadata, media_url, content_type, id')
    .eq('id', messageId)
    .single()

  if (!msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // If already a Supabase Storage URL (new format), redirect directly
  if (msg.media_url?.includes('/storage/v1/object/public/')) {
    return NextResponse.redirect(msg.media_url)
  }

  // If media_url is already a data: URL (base64), redirect to it
  if (msg.media_url?.startsWith('data:')) {
    return NextResponse.redirect(msg.media_url)
  }

  // If media_url is a regular URL, try to proxy it
  if (msg.media_url?.startsWith('http')) {
    try {
      const resp = await fetch(msg.media_url, {
        headers: { 'User-Agent': 'WhatsApp/2.23.20.77' }
      })
      if (resp.ok) {
        const buffer = await resp.arrayBuffer()
        const contentType = resp.headers.get('content-type') || 'image/jpeg'
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    } catch { /* CDN expired, fall through to Evolution proxy */ }
  }

  // Fallback: try to get media from Evolution API using stored metadata
  const metadata = msg.metadata || {}
  const mediaInfo = metadata?.media

  if (!mediaInfo?.mediaKey) {
    return NextResponse.json({ error: 'No media info available' }, { status: 404 })
  }

  const EVO_URL = process.env.EVOLUTION_API_URL || 'http://evolution-saas:8080'
  const EVO_KEY = process.env.EVOLUTION_API_KEY || ''

  // Find the instance for this message — query the conversation to get account → instance
  try {
    // Get conversation to find the instance
    const { data: conv } = await admin
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single()

    let instanceName = 'flujodigital'
    if (conv?.conversation_id) {
      const { data: conversation } = await admin
        .from('conversations')
        .select('account_id')
        .eq('id', conv.conversation_id)
        .single()

      if (conversation?.account_id) {
        const { data: inst } = await admin
          .from('whatsapp_instances')
          .select('evolution_instance_name')
          .eq('account_id', conversation.account_id)
          .limit(1)
          .single()

        if (inst?.evolution_instance_name) {
          instanceName = inst.evolution_instance_name
        }
      }
    }

    const messagePayload: any = {
      key: {
        remoteJid: 'status@broadcast',
        id: msg.id,
        fromMe: false,
      },
      message: {},
    }

    if (mediaInfo.mimetype?.startsWith('image')) {
      messagePayload.message.imageMessage = {
        url: mediaInfo.url,
        mimetype: mediaInfo.mimetype,
        fileLength: mediaInfo.fileLength,
        mediaKey: mediaInfo.mediaKey,
        directPath: mediaInfo.directPath,
      }
    } else if (mediaInfo.mimetype?.startsWith('video')) {
      messagePayload.message.videoMessage = {
        url: mediaInfo.url,
        mimetype: mediaInfo.mimetype,
        fileLength: mediaInfo.fileLength,
        mediaKey: mediaInfo.mediaKey,
        directPath: mediaInfo.directPath,
      }
    } else if (mediaInfo.mimetype?.startsWith('audio')) {
      messagePayload.message.audioMessage = {
        url: mediaInfo.url,
        mimetype: mediaInfo.mimetype,
        fileLength: mediaInfo.fileLength,
        mediaKey: mediaInfo.mediaKey,
        directPath: mediaInfo.directPath,
      }
    } else {
      messagePayload.message.imageMessage = {
        url: mediaInfo.url,
        mimetype: mediaInfo.mimetype || 'image/jpeg',
        fileLength: mediaInfo.fileLength,
        mediaKey: mediaInfo.mediaKey,
        directPath: mediaInfo.directPath,
      }
    }

    const resp = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
      },
      body: JSON.stringify({
        message: messagePayload,
      }),
    })

    if (resp.ok) {
      const result = await resp.json()
      const base64 = result?.base64 || ''
      if (base64) {
        const mime = mediaInfo.mimetype || 'image/jpeg'
        const buffer = Buffer.from(base64, 'base64')

        // Update the message with the data URL for future requests
        await admin.from('messages').update({
          media_url: `data:${mime};base64,${base64}`,
        }).eq('id', messageId)

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    }
  } catch (err: any) {
    console.error('[media/proxy] Evolution fallback failed:', err.message)
  }

  return NextResponse.json({ error: 'Media could not be retrieved' }, { status: 502 })
}
