-- Migración Wompi: payments + subscriptions
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID,
  wompi_tx_id TEXT,
  reference TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'emprendedor',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  wompi_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'emprendedor', 'pro', 'business', 'trial')),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),
  trial_start TIMESTAMPTZ DEFAULT now(),
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_id UUID REFERENCES public.payments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (
  account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT USING (
  account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Auto-create FREE trial subscription for new accounts (NOT pro by default!)
INSERT INTO public.subscriptions (account_id, plan, status, trial_start, trial_end)
SELECT DISTINCT account_id, 'free', 'trial', now(), now() + INTERVAL '14 days'
FROM public.profiles
WHERE account_id IS NOT NULL
  AND account_id NOT IN (SELECT account_id FROM public.subscriptions);
