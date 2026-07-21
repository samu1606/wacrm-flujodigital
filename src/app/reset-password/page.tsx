"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KeyRound, CheckCircle, AlertTriangle } from "lucide-react";

/**
 * Password reset form — reached after the auth callback exchanges the
 * recovery code for a session. The user MUST already be authenticated
 * (middleware enforces this); Supabase marks the session with a
 * PASSWORD_RECOVERY event that tells us it's a valid reset attempt.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [recoveryEvent, setRecoveryEvent] = useState(false);

  // Listen for PASSWORD_RECOVERY events after mount.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") {
          setRecoveryEvent(true);
        }
      }
    );

    // Also check if we're already in a recovery session (page was
    // loaded directly after the callback set the session).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        // If the session was created via recovery, the event may have
        // already fired before this component mounted. The session
        // still works — let the user proceed.
        setRecoveryEvent(true);
      } else {
        // No session at all — middleware should have caught this, but
        // be defensive.
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
    });

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to dashboard after a short pause so the user sees the
    // success message.
    setTimeout(() => router.replace("/dashboard"), 1500);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-xl text-foreground">
              ¡Contraseña actualizada!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Tu contraseña se ha cambiado exitosamente. Serás redirigido al
              dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Nueva contraseña
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Ingresá tu nueva contraseña. Mínimo 6 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recoveryEvent ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 mb-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Token de recuperación no detectado
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  El enlace de recuperación puede haber expirado. Solicitá uno
                  nuevo desde la página de login.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs mt-2"
                  onClick={() => router.replace("/forgot-password")}
                >
                  Solicitar nuevo enlace →
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-muted-foreground">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-muted-foreground"
                >
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Cambiar contraseña"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
