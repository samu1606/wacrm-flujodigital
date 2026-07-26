'use client';

import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { ENABLE_PAYWALL } from '@/lib/flags';
import { Loader2, Crown, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLAN_LINKS: Record<string, string> = {
  emprendedor: '/settings?tab=subscription&checkout=emprendedor',
  pro: '/settings?tab=subscription&checkout=pro',
  business: '/settings?tab=subscription&checkout=business',
};

/**
 * Guards dashboard access based on subscription status.
 * When NEXT_PUBLIC_ENABLE_PAYWALL=false (beta launch), all users
 * get free unlimited access — no paywall is ever shown.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { sub, loading: subLoading } = useSubscription();

  const paywallEnabled = ENABLE_PAYWALL;

  if (authLoading || subLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <>{children}</>;

  // Beta mode: free unlimited access — never show paywall.
  // The Banner below is an opt-in visual complement rendered by
  // the subscription-panel, not here.
  if (!paywallEnabled) return <>{children}</>;

  // ─── Wompi paywall (active when NEXT_PUBLIC_ENABLE_PAYWALL=true) ───
  const isActive = sub?.status === 'active';
  const isTrial = sub?.status === 'trial';
  const isExpired =
    sub?.status === 'expired' ||
    (sub?.status === 'trial' && (sub?.trialDaysLeft ?? 0) <= 0);

  if (isActive || (isTrial && !isExpired)) {
    return <>{children}</>;
  }

  if (!sub) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-950/50">
          <Clock className="size-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {isExpired ? 'Tu prueba gratuita terminó' : 'Sin suscripción activa'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Elige un plan para seguir usando WASAPEA PRO con todas las funcionalidades.
          </p>
        </div>

        <div className="space-y-3">
          <a href={PLAN_LINKS.emprendedor}>
            <Button className="w-full" variant="outline">
              Emprendedor — $15/mes
            </Button>
          </a>
          <a href={PLAN_LINKS.pro}>
            <Button className="w-full bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white">
              <Crown className="size-4 mr-2" />
              PRO — $29/mes (Más popular)
            </Button>
          </a>
          <a href={PLAN_LINKS.business}>
            <Button className="w-full" variant="outline">
              Business — $69/mes
            </Button>
          </a>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="size-3" />
          Pagos procesados por Wompi • Pesos colombianos
        </div>
      </div>
    </div>
  );
}
