-- Migración 002: Monetización de Alertas PRO
-- Añade trial_start y soporte para plan 'trial'

-- 1. Añadir columna trial_start
ALTER TABLE public.alert_subscribers 
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;

-- 2. Añadir 'trial' al CHECK constraint de plan
ALTER TABLE public.alert_subscribers 
DROP CONSTRAINT IF EXISTS alert_subscribers_product_check;

ALTER TABLE public.alert_subscribers 
DROP CONSTRAINT IF EXISTS alert_subscribers_plan_check;

ALTER TABLE public.alert_subscribers 
ADD CONSTRAINT alert_subscribers_plan_check 
CHECK (plan IN ('free', 'trial', 'pro', 'trader', 'investor', 'empresarial'));

-- 3. Tabla de comprobantes de pago (Nequi)
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  product TEXT,
  amount TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON public.payment_proofs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert" ON public.payment_proofs FOR INSERT WITH CHECK (true);

-- 4. Actualizar suscriptores existentes a 'trial' y poner trial_start
UPDATE public.alert_subscribers 
SET plan = 'trial', trial_start = NOW() 
WHERE plan = 'free' AND trial_start IS NULL;

-- 5. Funcion RPC para desactivar trials expirados (usada por workflow)
CREATE OR REPLACE FUNCTION public.deactivate_expired_trials()
RETURNS TABLE(phone TEXT, product TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE public.alert_subscribers
  SET active = false, updated_at = NOW()
  WHERE plan = 'trial'
    AND active = true
    AND trial_start < NOW() - INTERVAL '7 days'
  RETURNING alert_subscribers.phone, alert_subscribers.product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migración 002 completada' AS status;
