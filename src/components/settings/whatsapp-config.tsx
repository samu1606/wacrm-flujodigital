'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

type InstanceStatus = 'not_connected' | 'qr_ready' | 'connected' | 'disconnected' | 'loading';

interface InstanceInfo {
  status: string;
  instanceName?: string;
  phoneNumber?: string;
  profileName?: string;
  qrCode?: string | null;
  errorMessage?: string | null;
}

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<InstanceStatus>('loading');
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrHtml, setQrHtml] = useState<string>('');

  // Polling for QR scan
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/connect');
      const data = await res.json();

      if (!res.ok) {
        setStatus('not_connected');
        setInstance(null);
        setQrCode(null);
        setQrHtml('');
        return;
      }

      setInstance(data);

      if (data.status === 'connected') {
        setStatus('connected');
        setQrCode(null);
        setQrHtml('');
      } else if (data.status === 'qr_ready' && data.qrCode) {
        setStatus('qr_ready');
        setQrCode(data.qrCode);
        generateQrHtml(data.qrCode);
      } else if (data.status === 'no_account') {
        setStatus('not_connected');
        setQrCode(null);
        setQrHtml('');
      } else {
        setStatus('not_connected');
        setQrCode(null);
        setQrHtml('');
      }
    } catch {
      setStatus('not_connected');
      setInstance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      setStatus('not_connected');
      return;
    }
    fetchStatus();
  }, [authLoading, profileLoading, user?.id, accountId, fetchStatus]);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function generateQrHtml(code: string) {
    // Build a simple inline HTML page with the QR code embedded
    // We'll use a data: URL as a simple approach
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a0a;font-family:system-ui}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:40px;text-align:center;max-width:400px}
h2{color:#fff;margin-bottom:4px;font-size:20px}
.sub{color:#666;margin-bottom:20px;font-size:13px}
.qr-wrap{background:#fff;padding:16px;border-radius:16px;display:inline-block;margin-bottom:16px}
.hint{color:#555;font-size:12px;margin-top:12px}
.hint span{color:#25d366}
</style></head>
<body>
<div class="card">
<h2>📱 Escanea con WhatsApp</h2>
<p class="sub">Dispositivos Vinculados → Vincular dispositivo</p>
<div class="qr-wrap"><div id="qr"></div></div>
<p class="hint">Abre WhatsApp → Ajustes → <span>Dispositivos Vinculados</span></p>
</div>
<script>function QR8(t,e,n){n=n||{};var r=this._htOption={width:t||256,height:e||256,typeNumber:4,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRErrorCorrectLevel.H};"string"==typeof n&&(n={text:n});if(n)for(var o in n)r[o]=n[o];r.text=n.text||"QR";var u=document.createElement("canvas");u.width=r.width+40;u.height=r.height+40;var i=u.getContext("2d");i.fillStyle=r.colorLight;i.fillRect(0,0,u.width,u.height);var a=new QRCodeModel(qrText(r.text),r.correctLevel),f=a.getModuleCount(),c=(u.width-40)/f,s=(u.height-40)/f;for(var h=0;h<f;h++)for(var l=0;l<f;l++){var d=a.isDark(h,l);i.fillStyle=d?r.colorDark:r.colorLight;var p=Math.ceil((h+1)*c)-Math.floor(h*c),g=Math.ceil((l+1)*s)-Math.floor(l*s),v=Math.round(h*c)+20,w=Math.round(l*s)+20;i.fillRect(v,w,p,g)}var m=document.createElement("img");m.src=u.toDataURL("image/png");document.getElementById("qr")?document.getElementById("qr").appendChild(m):document.body.appendChild(m)}</script>
<script>new QR8(280,280,{text:${JSON.stringify(code)}});</script>
</body></html>`;

    setQrHtml(html);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create WhatsApp connection');
        setConnecting(false);
        return;
      }

      if (data.status === 'connected') {
        setStatus('connected');
        setInstance(data);
        toast.success('WhatsApp already connected!');
        setConnecting(false);
        return;
      }

      if (data.status === 'qr_ready' && data.qrCode) {
        setStatus('qr_ready');
        setQrCode(data.qrCode);
        setInstance(data);
        generateQrHtml(data.qrCode);
        toast.success('QR generated! Scan with your phone.');

        // Start polling for connection
        pollRef.current = setInterval(async () => {
          const statusRes = await fetch('/api/whatsapp/connect');
          const statusData = await statusRes.json();

          if (statusData.status === 'connected') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setStatus('connected');
            setQrCode(null);
            setQrHtml('');
            setInstance(statusData);
            toast.success('📱 WhatsApp connected!');
          } else if (statusData.status === 'disconnected' || statusData.status === 'not_connected') {
            // QR expired or disconnected — user needs to scan again
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setStatus('not_connected');
            setQrCode(null);
            setQrHtml('');
            toast.error('QR expired. Click Connect to try again.');
          }
        }, 3000);
      } else {
        toast.error('Could not get QR code. Please try again.');
        setStatus('not_connected');
      }
    } catch (err) {
      console.error('Connect error:', err);
      toast.error('Connection failed. Check network and try again.');
      setStatus('not_connected');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp from this account? You can reconnect anytime.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to disconnect');
        setDisconnecting(false);
        return;
      }

      toast.success('WhatsApp disconnected.');
      setStatus('not_connected');
      setInstance(null);
      setQrCode(null);
      setQrHtml('');
    } catch {
      toast.error('Disconnect failed. Try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    await fetchStatus();
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="WhatsApp"
          description="Conecta tu WhatsApp personal al CRM"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (authLoading || profileLoading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="WhatsApp"
          description="Conecta tu WhatsApp personal al CRM"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="WhatsApp"
        description="Escanea el código QR con tu WhatsApp para conectar"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Main area */}
        <div className="space-y-4">
          {/* Status Alert */}
          <Alert className={status === 'connected' ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-card border-border'}>
            <div className="flex items-center gap-2">
              {status === 'connected' ? (
                <CheckCircle2 className="size-5 text-emerald-400" />
              ) : status === 'qr_ready' ? (
                <Wifi className="size-5 text-amber-400 animate-pulse" />
              ) : (
                <WifiOff className="size-5 text-muted-foreground" />
              )}
              <AlertTitle className="text-foreground mb-0">
                {status === 'connected'
                  ? 'WhatsApp Conectado'
                  : status === 'qr_ready'
                  ? 'Esperando escaneo QR'
                  : 'WhatsApp No Conectado'}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground mt-1">
              {status === 'connected' && instance?.profileName
                ? `${instance.profileName} (${instance.phoneNumber || 'número vinculado'})`
                : status === 'connected'
                ? 'Tu WhatsApp está conectado al CRM.'
                : status === 'qr_ready'
                ? 'Escanea el código QR con tu teléfono para vincular.'
                : 'Conecta tu WhatsApp para empezar a gestionar conversaciones.'}
            </AlertDescription>
          </Alert>

          {/* Connected info */}
          {status === 'connected' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground text-base">Detalles de Conexión</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Tu WhatsApp está activo. Los mensajes entrantes aparecerán en la bandeja.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {instance?.profileName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Perfil</span>
                    <span className="text-foreground font-medium">{instance.profileName}</span>
                  </div>
                )}
                {instance?.phoneNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Número</span>
                    <span className="text-foreground font-medium">{instance.phoneNumber}</span>
                  </div>
                )}
                {instance?.instanceName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Instancia</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{instance.instanceName}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* QR Code Display */}
          {status === 'qr_ready' && qrCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <QrCode className="size-5" />
                  Escanea con WhatsApp
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Abre WhatsApp en tu teléfono → Dispositivos Vinculados → Vincular dispositivo
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="bg-white p-5 rounded-2xl inline-block">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="WhatsApp QR Code"
                    width={260}
                    height={260}
                    className="rounded-lg"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {status === 'not_connected' || status === 'disconnected' ? (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {connecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generando QR...
                  </>
                ) : (
                  <>
                    <Smartphone className="size-4" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            ) : status === 'qr_ready' ? (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                variant="outline"
                className="border-border"
              >
                {connecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Regenerar QR
                  </>
                )}
              </Button>
            ) : null}

            {status === 'connected' && (
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="outline"
                className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  <>
                    <LogOut className="size-4" />
                    Desconectar WhatsApp
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="border-border text-muted-foreground hover:text-foreground"
              title="Refrescar estado"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        {/* Sidebar Instructions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-base">Cómo funciona</CardTitle>
              <CardDescription className="text-muted-foreground">
                Así conectas tu WhatsApp al CRM en segundos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span>Haz clic en <strong className="text-foreground">Conectar WhatsApp</strong>. Se generará un código QR único para tu cuenta.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span>Abre WhatsApp en tu teléfono → <strong className="text-foreground">Dispositivos Vinculados</strong> → Vincular dispositivo.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  <span>Escanea el código QR con la cámara. En segundos tus mensajes empezarán a fluir al CRM.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                  <span>Tus conversaciones aparecerán en la bandeja del CRM. ¡Listo!</span>
                </li>
              </ol>

              <div className="mt-5 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  Sin número de WhatsApp Business
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  Sin Meta Developers account
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  Tu WhatsApp personal, en el CRM
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  Desconecta cuando quieras
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
