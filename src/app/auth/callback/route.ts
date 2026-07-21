import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Universal auth callback (Route Handler) — runs server-side so cookies
 * are set BEFORE the redirect, avoiding the race condition where the
 * middleware on the next request reads stale cookies.
 *
 * Handles:
 *  - PKCE code exchange (magic link, email OTP, password recovery)
 *  - `next` query param for post-auth routing (default: /dashboard)
 *  - `type=recovery` detection for password-reset flow
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");

  // Sanitised redirect target — caller sets ?next=/path
  const rawNext = requestUrl.searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  // Recovery type forces the reset-password page regardless of next param
  const redirectTo =
    type === "recovery" ? "/reset-password" : next;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Code exchange failed — the link may be expired or already used.
      // Redirect to login with an error message.
      const failUrl = new URL("/login", requestUrl.origin);
      failUrl.searchParams.set("error", "invalid_code");
      return NextResponse.redirect(failUrl);
    }

    // Success — session cookies are now set on this response.
    // Redirect to the appropriate post-auth page.
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
  }

  // No code present — direct navigation to /auth/callback. This
  // typically means the link is malformed. Send them to login.
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
