"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Universal auth callback — handles sign-in, sign-up, and password-recovery
 * flows. The `next` query param controls post-auth redirect (default: /dashboard).
 */
export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();

      // Resolve the redirect target — honour the caller's `next` param,
      // but sanitise it so an attacker can't craft an open-redirect payload.
      const rawNext = searchParams.get("next");
      const safeNext =
        rawNext && rawNext.startsWith("/")
          ? rawNext
          : "/dashboard";

      const hash = window.location.hash;

      // ── Hash fragment flow (implicit grant / older clients) ──
      if (hash && hash.includes("access_token")) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: authError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!authError) {
            // Password recovery via hash fragment — Supabase sends
            // type=recovery in the hash. Route to the reset form so
            // the user can set a new password.
            if (type === "recovery") {
              router.replace("/reset-password");
              return;
            }
            router.replace(safeNext);
            return;
          }
          setError(authError.message);
          setLoading(false);
          return;
        }
      }

      // ── PKCE code flow (default for @supabase/ssr) ──
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeErr } =
          await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeErr) {
          // After code exchange, check if this is a password-recovery
          // flow by inspecting the user (the session will have a
          // recovery aura). In PKCE mode Supabase may also attach
          // type=recovery as a query param on the redirect back.
          if (searchParams.get("type") === "recovery") {
            router.replace("/reset-password");
            return;
          }
          router.replace(safeNext);
          return;
        }
        setError(exchangeErr.message);
        setLoading(false);
        return;
      }

      setError("No se pudo completar la autenticación. Intentá de nuevo.");
      setLoading(false);
    };

    handleAuth();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Iniciando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/login" className="text-primary hover:underline">
          Ir al login
        </a>
      </div>
    </div>
  );
}
