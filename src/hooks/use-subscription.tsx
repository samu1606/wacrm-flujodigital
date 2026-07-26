'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/use-auth';

interface SubInfo {
  plan: string;
  status: string;
  trialDaysLeft: number;
  currentPeriodEnd?: string;
}

interface SubscriptionContextValue {
  /** Cached subscription info. null while loading or if not yet resolved. */
  sub: SubInfo | null;
  /** True while the subscription fetch is in-flight. */
  loading: boolean;
  /** Manually re-fetch subscription (e.g. after plan change). */
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, accountId, profileLoading } = useAuth();
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevent duplicate fetches during React Strict Mode double-mount.
  const fetchingRef = useRef(false);
  // Track the last accountId we fetched for so we refetch on account switch.
  const lastAccountIdRef = useRef<string | null>(null);

  const fetchSub = useCallback(async (account: string) => {
    if (fetchingRef.current && lastAccountIdRef.current === account) return;
    fetchingRef.current = true;
    lastAccountIdRef.current = account;

    try {
      const res = await fetch('/api/wompi/subscription');
      const data = await res.json();
      if (res.ok) setSub(data);
      // On non-OK, keep whatever we had (or null on first call).
      // The API auto-creates trials so this should rarely fail.
    } catch {
      /* network error — keep previous sub or null */
    }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    // Wait until auth + profile are fully resolved.
    if (profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      setSub(null);
      return;
    }
    // Only refetch if account changed (or first mount).
    if (lastAccountIdRef.current !== accountId) {
      setLoading(true);
      fetchSub(accountId);
    } else {
      // Already have data for this account — keep it.
      setLoading(false);
    }
  }, [user, accountId, profileLoading, fetchSub]);

  const refetch = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    await fetchSub(accountId);
  }, [accountId, fetchSub]);

  return (
    <SubscriptionContext.Provider value={{ sub, loading, refetch }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider.
    return { sub: null, loading: false, refetch: async () => {} };
  }
  return ctx;
}
