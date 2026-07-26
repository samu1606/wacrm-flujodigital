/**
 * Feature flags — set in .env / Dokploy env vars.
 * Changing these requires a redeploy (they're inlined at build time).
 */
export const ENABLE_PAYWALL =
  process.env.NEXT_PUBLIC_ENABLE_PAYWALL !== 'false'
