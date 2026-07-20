import { NextResponse } from 'next/server'

export async function GET() {
  const EVO_URL = process.env.EVOLUTION_API_URL || 'http://148.230.90.171:8096'
  const EVO_KEY = process.env.EVOLUTION_API_KEY || ''
  const INSTANCE = process.env.EVOLUTION_INSTANCE || 'flujodigital'

  try {
    const res = await fetch(`${EVO_URL}/instance/connect/${INSTANCE}`, {
      headers: { apikey: EVO_KEY },
      cache: 'no-store',
    })
    const data = await res.json()
    const code = data?.code || ''

    if (!code) {
      return NextResponse.json(
        { error: 'No QR code available', raw: data },
        { status: 500 }
      )
    }

    const qrHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp QR - FlujoDigital</title>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
*{margin:0;padding:0}
body{background:#0a0a0a;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;font-family:-apple-system,sans-serif}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:40px;text-align:center}
h2{color:#fff;margin-bottom:8px}
.sub{color:#666;margin-bottom:24px;font-size:14px}
#qr{background:#fff;padding:20px;border-radius:16px;display:inline-block}
.hint{color:#555;margin-top:20px;font-size:13px}
.hint span{color:#25d366}
</style></head>
<body><div class="card">
<h2>📱 Escanea con WhatsApp</h2>
<p class="sub">Dispositivos Vinculados → Vincular dispositivo</p>
<div id="qr"></div>
<p class="hint">WhatsApp → <span>Dispositivos Vinculados</span></p>
</div>
<script>new QRCode(document.getElementById("qr"),{text:${JSON.stringify(code)},width:320,height:320,colorDark:"#000",colorLight:"#fff"});</script>
</body></html>`

    return new NextResponse(qrHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
