import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Thin HTML page that extracts hash-fragment auth tokens and reloads
 * the callback with them as query params so the Route Handler can
 * process them server-side.
 *
 * Needed because Supabase can deliver tokens in TWO ways:
 *  1. PKCE flow: ?code=<code>          → server can read ✅
 *  2. Implicit flow: #access_token=...  → server NEVER sees this ❌
 *
 * This page converts #2 into #1 by extracting hash params, setting
 * them as query params, and reloading. The second request hits the
 * route handler with query params it can actually process.
 */
const HASH_CAPTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Iniciando sesión…</title>
</head>
<body>
  <noscript>JavaScript is required to complete sign in.</noscript>
  <script>
    (function () {
      var hash = window.location.hash;
      if (!hash || hash.length < 2) {
        // No hash fragment — the route handler already redirected
        // to /login.  This script only runs when the handler
        // returned this fallback page, so if there's no hash the
        // link is truly malformed.
        window.location.replace('/login');
        return;
      }
      var params = new URLSearchParams(hash.substring(1));
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var type = params.get('type');

      if (!accessToken || !refreshToken) {
        window.location.replace('/login');
        return;
      }

      // Rebuild the URL with hash tokens as query params so the
      // server-side route handler can exchange them.
      var url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('refresh_token', refreshToken);
      if (type) url.searchParams.set('type', type);
      window.location.replace(url.toString());
    })();
  </script>
</body>
</html>`;

/**
 * Universal auth callback (Route Handler) — runs server-side so cookies
 * are set BEFORE the redirect, avoiding the race condition where the
 * middleware on the next request reads stale cookies.
 *
 * Handles:
 *  - PKCE code exchange (magic link, email OTP, password recovery)
 *  - Implicit flow (hash → query → setSession) via HTML fallback
 *  - `next` query param for post-auth routing (default: /dashboard)
 *  - `type=recovery` detection for password-reset flow
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const accessToken = requestUrl.searchParams.get("access_token");
  const refreshToken = requestUrl.searchParams.get("refresh_token");
  const type = requestUrl.searchParams.get("type");

  // Sanitised redirect target — caller sets ?next=/path
  const rawNext = requestUrl.searchParams.get("next");
  const safeNext =
    rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  // Recovery type forces the reset-password page regardless of next param
  const postAuthPath =
    type === "recovery" ? "/reset-password" : safeNext;

  const supabase = await createClient();

  // ── PKCE flow: exchange the code ───────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] PKCE code exchange failed:", error.message);
      const failUrl = new URL("/login", requestUrl.origin);
      failUrl.searchParams.set("error", "invalid_code");
      return NextResponse.redirect(failUrl);
    }

    return NextResponse.redirect(
      new URL(postAuthPath, requestUrl.origin)
    );
  }

  // ── Implicit flow: set the session from access_token ───────
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error("[auth/callback] setSession failed:", error.message);
      const failUrl = new URL("/login", requestUrl.origin);
      failUrl.searchParams.set("error", "invalid_token");
      return NextResponse.redirect(failUrl);
    }

    return NextResponse.redirect(
      new URL(postAuthPath, requestUrl.origin)
    );
  }

  // ── No auth params in query — serve the hash-capture page ──
  // This handles the case where Supabase delivered tokens via
  // hash fragment (implicit flow). The HTML page extracts them,
  // converts them to query params, and reloads — hitting this
  // handler again with access_token + refresh_token above.
  return new NextResponse(HASH_CAPTURE_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
