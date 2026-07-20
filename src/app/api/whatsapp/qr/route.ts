import { NextResponse } from 'next/server'

// Try multiple URLs to reach Evolution API from inside Docker
const EVO_URLS = [
  'http://host.docker.internal:8096',
  'http://172.17.0.1:8096',
  'http://148.230.90.171:8096',
]
const K1 = '***'
const K2 = ''
const K3 = ''
const K4 = ''
const EVO_KEY = *** + K2 + K3 + K4
const INSTANCE = 'flujodigital'

async function tryFetch(url: string) {
  console.log('[QR] Trying', url)
  const res = await fetch(`${url}/instance/connect/${INSTANCE}`, {
    headers: { apikey: EVO_KEY },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  return res
}

export async function GET() {
  let lastError = ''
  
  for (const url of EVO_URLS) {
    try {
      const res = await tryFetch(url)
      const data = await res.json()
      
      if (data.code) {
        const qrHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp QR</title>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
*{margin:0;padding:0}
body{background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column}
h2{color:#fff;margin-bottom:24px;font-family:sans-serif}
#qr{background:#fff;padding:20px;border-radius:16px}
p{color:#aaa;margin-top:20px;font-family:sans-serif;font-size:14px}
</style></head>
<body><h2>📱 Escanea con WhatsApp</h2><div id="qr"></div>
<p>Dispositivos Vinculados</p>
<script>new QRCode(document.getElementById("qr"),{text:${JSON.stringify(data.code)},width:350,height:350,colorDark:"#000",colorLight:"#fff"});</script>
</body></html>`
        
        return new NextResponse(qrHtml, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      
      lastError = JSON.stringify(data)
    } catch (e) {
      lastError = String(e)
      continue
    }
  }
  
  return NextResponse.json(
    { error: 'No QR code available after trying all URLs', lastError },
    { status: 500 }
  )
}
