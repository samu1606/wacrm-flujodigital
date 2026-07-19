"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();

      // Supabase returns the session in the URL hash for magiclink/OAuth
      // The hash contains: #access_token=xxx&refresh_token=xxx&type=magiclink
      const hash = window.location.hash;

      if (hash && hash.includes("access_token")) {
        // Parse the hash and set the session
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!setError) {
            router.replace("/dashboard");
            return;
          }
          setError(setError.message);
        }
      } else {
        // Check for code param (PKCE flow)
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            router.replace("/dashboard");
            return;
          }
          setError(exchangeError.message);
        }
      }

      setError("No se pudo completar la autenticación");
      setLoading(false);
    };

    handleAuth();
  }, [router]);

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
          Volver al login
        </a>
      </div>
    </div>
  );
}
