/**
 * Process-wide undici dispatcher configuration.
 *
 * Replaces undici's default 10 s connect timeout with a tighter value so that
 * unreachable upstream IPs (DNS round-robin can return endpoints that fail to
 * route on some networks) fail fast and let the resilience layer retry against
 * a fresh DNS pick rather than burning the full 10 s per attempt.
 *
 * Affects every `fetch()` call in this process — Anthropic, OpenAI, Gemini,
 * any HTTP probe — so the value should comfortably exceed normal handshake
 * latency. 5 s is the default; override with `HTTP_CONNECT_TIMEOUT_MS`.
 */

import { Agent, setGlobalDispatcher } from 'undici';

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

export interface HttpDispatcherConfig {
  readonly connectTimeoutMs: number;
}

function readTimeoutFromEnv(): number {
  const raw = process.env['HTTP_CONNECT_TIMEOUT_MS'];
  if (raw === undefined) return DEFAULT_CONNECT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CONNECT_TIMEOUT_MS;
  return parsed;
}

export function configureGlobalHttpDispatcher(): HttpDispatcherConfig {
  const connectTimeoutMs = readTimeoutFromEnv();
  const agent = new Agent({ connect: { timeout: connectTimeoutMs } });
  setGlobalDispatcher(agent);
  return { connectTimeoutMs };
}
