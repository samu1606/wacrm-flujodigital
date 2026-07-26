"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SubscriptionProvider } from "@/hooks/use-subscription";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Track whether the initial auth check has completed. After the first
  // successful load, we NEVER show the full-screen loading spinner again —
  // even if the provider remounts briefly during client-side navigation.
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Loading state: only show full-screen spinner on the VERY FIRST render.
  // After initialLoadDone is true, we keep rendering the shell even if
  // loading flickers — this prevents the black-screen flash when switching
  // conversations or navigating within the dashboard.
  if (loading && !initialLoadDone.current) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User not logged in AND initial load done → nothing to render
  // (the redirect effect above will fire).
  if (!user && initialLoadDone.current) return null;
  // User not logged in AND initial load not done → we're still in
  // the auth check phase, handled by the loading gate above.
  if (!user) return null;

  // Mark initial load as done so future flickers don't flash the spinner.
  if (!initialLoadDone.current) {
    initialLoadDone.current = true;
  }

  return (
    <SubscriptionProvider>
      <SubscriptionGate>
        <div className="flex h-screen overflow-hidden bg-background">
          <PresenceHeartbeat />
          <Sidebar open={sidebarOpen} onClose={closeSidebar} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </SubscriptionGate>
    </SubscriptionProvider>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
