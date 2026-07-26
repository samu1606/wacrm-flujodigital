-- 🚀 Ejecutar en Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/zavabpchdvssvdnwtuyu/sql/new
-- O desde el dashboard: zavabpchdvssvdnwtuyu → SQL Editor → New Query

-- Tabla de suscriptores de alertas
CREATE TABLE IF NOT EXISTS public.alert_subscribers (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('cryptotrader', 'forexalert', 'goldtrack', 'secop', 'trm', 'vigilante')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'trader', 'investor', 'empresarial')),
  active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phone, product)
);

-- RLS
ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY;

-- Service role puede todo
CREATE POLICY "service_all" ON public.alert_subscribers FOR ALL USING (true) WITH CHECK (true);

-- Anon puede insertar (para signup desde landing)
CREATE POLICY "anon_insert" ON public.alert_subscribers FOR INSERT WITH CHECK (true);

-- Índice
CREATE INDEX idx_alert_subs_product_active ON public.alert_subscribers(product, active);

-- Comentario
COMMENT ON TABLE public.alert_subscribers IS 'Suscriptores de alertas WhatsApp: CryptoTrader, ForexAlert, GoldTrack, SECOP, TRM, Vigilante Digital';

-- Verificar
SELECT * FROM public.alert_subscribers;
