/**
 * Shared k6 configuration and helpers for Sabha load tests.
 *
 * Usage in test files:
 *   import { BASE_URL, authHeaders, getToken } from './config.js'
 *
 * Run a test:
 *   k6 run --env BASE_URL=http://localhost:3001 k6/load-tests/auth.test.js
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'

// ─── Load Stages ──────────────────────────────────────────────────────────────

/** Smoke test: 1 VU, 30s — sanity check that nothing is broken */
export const STAGES_SMOKE = [
  { duration: '30s', target: 1 },
]

/** Load test: ramp to 100 VUs over 2 minutes, hold for 5 minutes, ramp down */
export const STAGES_LOAD = [
  { duration: '1m', target: 20 },
  { duration: '2m', target: 100 },
  { duration: '5m', target: 100 },
  { duration: '2m', target: 0 },
]

/** Stress test: ramp up to 500 VUs to find breaking point */
export const STAGES_STRESS = [
  { duration: '2m',  target: 100 },
  { duration: '5m',  target: 100 },
  { duration: '2m',  target: 300 },
  { duration: '5m',  target: 300 },
  { duration: '2m',  target: 500 },
  { duration: '5m',  target: 500 },
  { duration: '5m',  target: 0 },
]

/** Spike test: sudden spike to 1000 VUs */
export const STAGES_SPIKE = [
  { duration: '30s', target: 10 },
  { duration: '1m',  target: 1000 },
  { duration: '3m',  target: 1000 },
  { duration: '1m',  target: 10 },
  { duration: '30s', target: 0 },
]

/** Soak test: 50 VUs sustained for 2 hours */
export const STAGES_SOAK = [
  { duration: '5m',  target: 50 },
  { duration: '2h',  target: 50 },
  { duration: '5m',  target: 0 },
]

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const THRESHOLDS_STRICT = {
  http_req_failed:   ['rate<0.01'],          // error rate < 1%
  http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95th pct < 500ms, 99th < 1s
}

export const THRESHOLDS_RELAXED = {
  http_req_failed:   ['rate<0.05'],          // error rate < 5% (for AI calls)
  http_req_duration: ['p(95)<5000', 'p(99)<10000'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export function jsonBody(obj) {
  return JSON.stringify(obj)
}

/** Generate a unique email for each VU iteration */
export function uniqueEmail(vuId, iterationId) {
  return `loadtest+vu${vuId}i${iterationId}@sabha-test.internal`
}

/** Check helper for cleaner assertions */
export function checkResponse(response, name, expectedStatus = 200) {
  const ok = response.status === expectedStatus
  if (!ok) {
    console.error(`[${name}] Expected ${expectedStatus}, got ${response.status}: ${response.body?.slice(0, 200)}`)
  }
  return ok
}
