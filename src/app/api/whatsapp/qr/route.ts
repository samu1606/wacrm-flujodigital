import { NextResponse } from 'next/server'

const EVO_URL = 'http://148.230.90.171:8096'
const EVO_KEY = '***'
const INSTANCE = 'flujodigital'

export async function GET() {
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

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp QR - FlujoDigital</title>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
body{background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;flex-direction:column;padding:20px}
h2{color:#fff;font-family:sans-serif;margin-bottom:20px;text-align:center}
#qrcode{background:#fff;padding:16px;border-radius:16px;display:inline-block}
p{color:#aaa;font-family:sans-serif;margin-top:20px;font-size:14px;text-align:center}
</style>
</head>
<body>
<h2>📱 Escanea este QR con WhatsApp</h2>
<div id="qrcode"></div>
<p>WhatsApp → Dispositivos Vinculados → Vincular un dispositivo</p>
<script>
new QRCode(document.getElementById("qrcode"), {
  text: ${JSON.stringify(code)},
  width: 350,
  height: 350,
  colorDark: "#000000",
  colorLight: "#ffffff"
});
</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
