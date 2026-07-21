'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  free: {
    name: 'Gratuito / Prueba',
    price: '$0/mes',
    features: ['Prueba de 14 días', 'Funcionalidades básicas', 'Sin tarjeta requerida'],
  },
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
    WidgetCheckout?: new (config: any) => any;
  }
}

export function SubscriptionPanel() {
  const { user, accountId, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const checkoutPlan = searchParams.get('checkout'); // Auto-trigger from landing page
  const autoTriggered = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);

  const fetchSub = useCallback(async () => {
    try {
      const res = await fetch('/api/wompi/subscription');
      const data = await res.json();
      if (res.ok) setSub(data);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchSub();
  }, [authLoading, fetchSub]);

  // Auto-trigger checkout when arriving from landing page with ?checkout=plan
  useEffect(() => {
    if (!checkoutPlan || autoTriggered.current || authLoading || loading) return;
    autoTriggered.current = true;
    // Small delay to let widget load
    const t = setTimeout(() => handleCheckout(checkoutPlan), 500);
    return () => clearTimeout(t);
  }, [checkoutPlan, authLoading, loading, widgetReady]);

  // Load Wompi widget script once
  useEffect(() => {
    if (widgetReady) return;
    if (document.querySelector('script[src*="checkout.wompi.co"]')) {
      setWidgetReady(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.wompi.co/widget.js';
    s.async = true;
    s.onload = () => setWidgetReady(true);
    s.onerror = () => console.warn('Wompi widget failed to load');
    document.head.appendChild(s);
  }, [widgetReady]);

  async function handleCheckout(plan: string) {
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/wompi/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || 'Error al crear el pago');
        return;
      }

      // Payment link mode — simple redirect, no widget
      if (data.paymentLink) {
        toast.info('Redirigiendo a la pasarela de pago...');
        window.open(data.paymentLink, '_blank');
        return;
      }

      // Widget mode
      if (!window.WidgetCheckout) {
        toast.error('Cargando pasarela de pago... intenta en 5 segundos');
        return;
      }

      const checkout = new window.WidgetCheckout({
        currency: data.currency || 'COP',
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        signature: { integrity: data.signatureIntegrity },
        redirectUrl: 'https://wasapeapro.com/settings?tab=subscription',
      });

      checkout.open((result: any) => {
        console.log('[wompi] result:', result);
        const tx = result?.transaction;
        if (tx?.status === 'APPROVED') {
          toast.success('¡Pago aprobado! 🎉');
          setTimeout(fetchSub, 3000);
        } else if (tx?.status === 'PENDING') {
          toast.info('Pago pendiente. Te notificaremos.');
          setTimeout(fetchSub, 5000);
        } else {
          toast.error('Pago no completado');
        }
      });
    } catch (err: any) {
      console.error('[wompi] error:', err?.message || err);
      toast.error(err?.message || 'Error al procesar el pago');
    } finally {
      setLoadingPlan(null);
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

  const planKey = sub?.plan || 'free';
  const planName = PLAN_DETAILS[planKey]?.name || 'Gratuito';
  const isActive = sub?.status === 'active';
  const isTrial = sub?.status === 'trial';
  const isExpired = sub?.status === 'expired';
  const isFree = planKey === 'free' || !sub || sub?.status === 'no_subscription';

  return (
    <section>
      <SettingsPanelHead title="Suscripción" description="Gestiona tu plan y pagos" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Crown className="size-5 text-amber-400" /> Plan Actual
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isActive && 'Tu suscripción está activa'}
              {isTrial && `${sub?.trialDaysLeft || 0} días restantes de prueba`}
              {isExpired && 'Tu prueba ha expirado — elige un plan'}
              {!isActive && !isTrial && !isExpired && 'Sin suscripción activa'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-extrabold">
                {PLAN_DETAILS[planKey]?.price || '$0/mes'}
              </span>
              <span className="text-muted-foreground text-sm">{planName}</span>
            </div>
            {isFree ? (
              <Alert className="bg-blue-950/30 border-blue-700/50">
                <Clock className="size-4 text-blue-400" />
                <AlertTitle className="text-blue-200">Plan Gratuito</AlertTitle>
                <AlertDescription className="text-blue-100/80 text-sm">
                  Elige un plan de pago para desbloquear todas las funcionalidades.
                </AlertDescription>
              </Alert>
            ) : isTrial && (
              <Alert className="bg-amber-950/30 border-amber-700/50">
                <Clock className="size-4 text-amber-400" />
                <AlertTitle className="text-amber-200">Prueba de 14 días</AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  Te quedan {sub?.trialDaysLeft || 0} días.
                </AlertDescription>
              </Alert>
            )}
            {isActive && (
              <Alert className="bg-emerald-950/30 border-emerald-700/50">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <AlertTitle className="text-emerald-200">Suscripción Activa</AlertTitle>
                <AlertDescription className="text-emerald-100/80 text-sm">
                  Plan {planName} activo.
                </AlertDescription>
              </Alert>
            )}
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(PLAN_DETAILS[planKey]?.features || []).map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Zap className="size-5 text-amber-400" /> Cambiar de Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
              const isCurrentPlan = planKey === key;
              // Don't show free plan in upgrade list
              if (key === 'free') return null;
              return (
              <div key={key}
                className={`p-4 rounded-xl border ${isCurrentPlan ? 'border-[#FF6B00]/50 bg-[#FF6B00]/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{plan.name}
                    {isCurrentPlan && <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-[#FF6B00]/20 text-[#FF6B00] font-bold">Actual</span>}
                  </span>
                  <span className="text-lg font-bold">{plan.price}</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 mb-3">
                  {plan.features.map(f => <li key={f}>• {f}</li>)}
                </ul>
                <Button
                  size="sm"
                  onClick={() => handleCheckout(key)}
                  disabled={loadingPlan !== null || !widgetReady}
                  className={key === 'pro' ? 'w-full bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white' : 'w-full'}
                >
                  {loadingPlan === key ? <Loader2 className="size-3.5 animate-spin" /> : <>Pagar {plan.name} <ExternalLink className="size-3 ml-1" /></>}
                </Button>
              </div>
            )})}
            {!widgetReady && <p className="text-xs text-muted-foreground text-center">Cargando pasarela...</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
