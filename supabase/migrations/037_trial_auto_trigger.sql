-- ============================================================
-- Migration 037: Auto-create trial subscription on new account
-- ============================================================
-- When a new account is inserted, automatically create a 14-day
-- free trial subscription so the user can start using the app
-- immediately without manual provisioning.
-- ============================================================

-- 1. Function that runs AFTER INSERT on public.accounts
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (account_id, plan, status, trial_start, trial_end)
  VALUES (
    NEW.id,
    'free',
    'trial',
    now(),
    now() + INTERVAL '14 days'
  )
  ON CONFLICT (account_id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.auto_create_trial_subscription() OWNER TO postgres;

-- 2. Trigger: fires after every INSERT on accounts
DROP TRIGGER IF EXISTS tr_auto_create_trial ON public.accounts;
CREATE TRIGGER tr_auto_create_trial
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_trial_subscription();

-- 3. Backfill: create trial for existing accounts that don't have one yet
INSERT INTO public.subscriptions (account_id, plan, status, trial_start, trial_end)
SELECT a.id, 'free', 'trial', now(), now() + INTERVAL '14 days'
FROM public.accounts a
WHERE a.id NOT IN (SELECT account_id FROM public.subscriptions)
ON CONFLICT (account_id) DO NOTHING;
