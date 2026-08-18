export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';
export const REFRESH_TOKEN_PREFIX = 'refresh_token:';
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const BCRYPT_SALT_ROUNDS_DEFAULT = 12;

// Progressive login delay (per-email)
export const LOGIN_FAIL_PREFIX = 'login_fail:';
export const LOGIN_FAIL_TTL_SECONDS = 3600; // 1 hour
export const MAX_DELAY_SECONDS = 30;

// Refresh token cookie
export const REFRESH_COOKIE_NAME = 'clawix_refresh';
// Cookie Path is matched against the URL the *browser* requests, not the
// path AuthController sees server-side. Behind a reverse proxy that rewrites
// paths (e.g. Caddy `handle_path /api/*` stripping the prefix before
// forwarding to `/auth/...`), the browser only ever calls `/api/auth/...` —
// a cookie scoped to `/auth` never matches that and is silently dropped,
// breaking every refresh. Scope to the whole origin so it survives any
// proxy path-prefixing scheme.
export const REFRESH_COOKIE_PATH = '/';
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
