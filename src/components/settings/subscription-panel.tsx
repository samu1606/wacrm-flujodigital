'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Crown, Zap, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

interface SubInfo {
  plan: string;
  status: string;
  trialDaysLeft: number;
  trialStart?: string;
  currentPeriodEnd?: string;
}

const PLAN_DETAILS: Record<string, { name: string; price: string; features: string[] }> = {
  emprendedor: {
    name: 'Emprendedor',
    price: '$15/mes',
    features: ['1 WhatsApp', '1 Asesor', '100 Contactos', 'Kanban Simple'],
  },
  pro: {
    name: 'PRO',
    price: '$29/mes',
    features: ['1 WhatsApp', '5 Asesores', 'Contactos Ilimitados', 'Broadcasts', 'Soporte Prioritario'],
  },
  business: {
    name: 'Business',
    price: '$69/mes',
    features: ['Múltiples WhatsApp', 'Asesores Ilimitados', 'API de acceso', 'Todo lo de PRO'],
  },
};

declare global {
  interface Window {
    WompiCheckout?: new (config: any) => any;
  }
}

export function SubscriptionPanel() {
  const { user, accountId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [wompiLoaded, setWompiLoaded] = useState(false);
  const wompiScriptRef = useRef<HTMLScriptElement | null>(null);

  const fetchSub = useCallback(async () => {
    try {
      const res = await fetch('/api/wompi/subscription');
      const data = await res.json();
      if (res.ok) setSub(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchSub();
  }, [authLoading, fetchSub]);

  // Load Wompi.js widget
  useEffect(() => {
    if (wompiLoaded) return;
    if (document.querySelector('script[src*="checkout.wompi.co"]')) {
      setWompiLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => setWompiLoaded(true);
    script.onerror = () => console.warn('[wompi] widget script failed to load');
    document.head.appendChild(script);
    wompiScriptRef.current = script;
    return () => {
      if (wompiScriptRef.current) {
        document.head.removeChild(wompiScriptRef.current);
      }
    };
  }, [wompiLoaded]);

  async function handleCheckout(plan: string) {
    setCheckingOut(true);
    try {
      const res = await fetch('/api/wompi/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al crear el pago');
        setCheckingOut(false);
        return;
      }

      // Open Wompi widget
      if (window.WompiCheckout) {
        const checkout = new window.WompiCheckout({
          currency: data.currency,
          amountInCents: data.amountInCents,
          reference: data.reference,
          publicKey: data.publicKey,
          signature: {
            integrity: data.signatureIntegrity,
          },
          redirectUrl: window.location.origin + '/settings?tab=subscription',
          expirationTime: new Date(Date.now() + 86400000).toISOString(), // 24h
          customerData: {
            email: data.customerEmail,
            fullName: data.customerName,
            phoneNumber: data.customerPhone,
          },
        });

        checkout.open((result: any) => {
          console.log('[wompi] result:', result);
          const tx = result?.transaction;
          if (tx?.status === 'APPROVED') {
            toast.success('¡Pago aprobado! 🎉 Tu suscripción se activó.');
            // Refresh subscription status
            setTimeout(fetchSub, 2000);
          } else if (tx?.status === 'PENDING') {
            toast.info('Pago pendiente. Te notificaremos cuando se confirme.');
            setTimeout(fetchSub, 5000);
          } else {
            toast.error(tx?.statusMessage || 'El pago no fue aprobado. Intenta de nuevo.');
          }
          setCheckingOut(false);
        });
      } else {
        toast.error('Widget de pago no disponible. Actualiza la página e intenta de nuevo.');
        setCheckingOut(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Error al procesar el pago');
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <section>
        <SettingsPanelHead title="Suscripción" description="Gestiona tu plan y pagos" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const planName = PLAN_DETAILS[sub?.plan || 'emprendedor']?.name || 'Emprendedor';
  const isActive = sub?.status === 'active';
  const isTrial = sub?.status === 'trial';
  const isExpired = sub?.status === 'expired';

  return (
    <section>
      <SettingsPanelHead title="Suscripción" description="Gestiona tu plan y pagos" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Crown className="size-5 text-amber-400" />
              Plan Actual
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isActive && 'Tu suscripción está activa'}
              {isTrial && `${sub?.trialDaysLeft || 0} días restantes de prueba`}
              {isExpired && 'Tu prueba ha expirado — elige un plan para continuar'}
              {!isActive && !isTrial && !isExpired && 'Sin suscripción activa'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold text-foreground">
                {PLAN_DETAILS[sub?.plan || 'emprendedor']?.price || '$15/mes'}
              </span>
              <span className="text-muted-foreground text-sm">{planName}</span>
            </div>

            {isTrial && (
              <Alert className="bg-amber-950/30 border-amber-700/50">
                <Clock className="size-4 text-amber-400" />
                <AlertTitle className="text-amber-200">Prueba de 14 días</AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  Te quedan {sub?.trialDaysLeft || 0} días. Después necesitarás elegir un plan pago.
                </AlertDescription>
              </Alert>
            )}

            {isActive && (
              <Alert className="bg-emerald-950/30 border-emerald-700/50">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <AlertTitle className="text-emerald-200">Suscripción Activa</AlertTitle>
                <AlertDescription className="text-emerald-100/80 text-sm">
                  Tu plan {planName} está activo. Se renovará automáticamente.
                </AlertDescription>
              </Alert>
            )}

            <ul className="space-y-2 text-sm text-muted-foreground">
              {(PLAN_DETAILS[sub?.plan || 'emprendedor']?.features || []).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Zap className="size-5 text-amber-400" />
              Cambiar de Plan
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Elige el plan que mejor se adapte a tu negocio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(PLAN_DETAILS).map(([key, plan]) => (
              <div
                key={key}
                className={`p-4 rounded-xl border ${
                  sub?.plan === key
                    ? 'border-[#FF6B00]/50 bg-[#FF6B00]/5'
                    : 'border-border hover:border-white/20'
                } transition-all`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    {sub?.plan === key && (
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-[#FF6B00]/20 text-[#FF6B00] font-bold uppercase">
                        Actual
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-foreground">{plan.price}</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 mb-3">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                {sub?.plan !== key && (
                  <Button
                    size="sm"
                    onClick={() => handleCheckout(key)}
                    disabled={checkingOut || !wompiLoaded}
                    className={
                      key === 'pro'
                        ? 'w-full bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-amber-500 hover:to-[#FF6B00] text-white'
                        : 'w-full bg-primary hover:bg-primary/90 text-primary-foreground'
                    }
                  >
                    {checkingOut ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        Elegir {plan.name} <ExternalLink className="size-3 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
            {!wompiLoaded && (
              <p className="text-xs text-muted-foreground text-center">Cargando pasarela de pago...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
