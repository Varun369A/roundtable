/**
 * Full user journey load test — simulates a realistic usage session.
 *
 * Journey:
 *   signup → login → visit marketplace → create task → stream → billing page
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3001 k6/load-tests/full-flow.test.js
 *
 * For spike testing:
 *   k6 run --env SCENARIO=spike --env BASE_URL=http://localhost:3001 k6/load-tests/full-flow.test.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import {
  BASE_URL,
  STAGES_LOAD,
  STAGES_SPIKE,
  THRESHOLDS_STRICT,
  authHeaders,
  jsonBody,
  uniqueEmail,
} from './config.js'

const journeyComplete = new Rate('sabha_journey_complete_rate')
const journeyDuration = new Trend('sabha_journey_duration_ms')
const apiErrors       = new Counter('sabha_api_errors')

const scenario = __ENV.SCENARIO || 'load'

export const options = {
  stages: scenario === 'spike' ? STAGES_SPIKE : STAGES_LOAD,
  thresholds: {
    ...THRESHOLDS_STRICT,
    sabha_journey_complete_rate: ['rate>0.95'],
    sabha_journey_duration_ms:   ['p(95)<10000'],
  },
}

export default function () {
  const email    = uniqueEmail(__VU, __ITER)
  const password = 'JourneyTest@123!'
  const journeyStart = Date.now()
  let token = null
  let journeyOk = true

  // ── Step 1: Signup ────────────────────────────────────────────────────────────
  group('1_signup', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/signup`,
      jsonBody({ email, password, name: 'Journey User' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (res.status !== 201) { journeyOk = false; apiErrors.add(1); return }
    token = JSON.parse(res.body).data.accessToken
    check(res, { '1_signup: ok': () => true })
  })

  if (!token) { sleep(1); return }
  sleep(0.5)

  // ── Step 2: Browse Marketplace ────────────────────────────────────────────────
  group('2_marketplace', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/marketplace/models`,
      { headers: authHeaders(token), tags: { route: '/api/v1/marketplace/models' } }
    )
    const ok = check(res, { '2_marketplace: status 200': (r) => r.status === 200 })
    if (!ok) { journeyOk = false; apiErrors.add(1) }
  })

  sleep(1) // user browses

  // ── Step 3: Check Billing Status ─────────────────────────────────────────────
  group('3_billing_status', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/billing/status`,
      { headers: authHeaders(token), tags: { route: '/api/v1/billing/status' } }
    )
    const ok = check(res, { '3_billing: status 200': (r) => r.status === 200 })
    if (!ok) { journeyOk = false; apiErrors.add(1) }
  })

  sleep(0.5)

  // ── Step 4: Create Task ───────────────────────────────────────────────────────
  let taskId = null
  group('4_create_task', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/tasks`,
      jsonBody({ goal: 'Write a marketing email for a SaaS product' }),
      { headers: authHeaders(token), tags: { route: '/api/v1/tasks' } }
    )
    const ok = check(res, {
      '4_create_task: status 201': (r) => r.status === 201,
      '4_create_task: has id':     (r) => !!JSON.parse(r.body || '{}')?.data?.id,
    })
    if (!ok) { journeyOk = false; apiErrors.add(1); return }
    taskId = JSON.parse(res.body).data.id
  })

  if (!taskId) { sleep(1); return }
  sleep(0.5)

  // ── Step 5: Start Task ────────────────────────────────────────────────────────
  group('5_start_task', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/tasks/${taskId}/start`,
      null,
      { headers: authHeaders(token), tags: { route: '/api/v1/tasks/:id/start' } }
    )
    const ok = check(res, { '5_start_task: status 202': (r) => r.status === 202 })
    if (!ok) { journeyOk = false; apiErrors.add(1) }
  })

  sleep(1)

  // ── Step 6: Verify Stream Endpoint ───────────────────────────────────────────
  group('6_verify_stream', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/stream/${taskId}?token=${token}`,
      { timeout: '5s', tags: { route: '/api/v1/stream/:id' } }
    )
    const ok = check(res, {
      '6_stream: responds': (r) => r.status === 200 || r.status === 404, // 404 if task already done
    })
    if (!ok) { journeyOk = false; apiErrors.add(1) }
  })

  sleep(0.5)

  // ── Step 7: Check Language Settings ──────────────────────────────────────────
  group('7_language_settings', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/language/preference`,
      { headers: authHeaders(token), tags: { route: '/api/v1/language/preference' } }
    )
    check(res, { '7_language: status 200': (r) => r.status === 200 })
  })

  sleep(0.5)

  // ── Cleanup: Cancel Task ──────────────────────────────────────────────────────
  if (taskId) {
    http.del(
      `${BASE_URL}/api/v1/tasks/${taskId}`,
      null,
      { headers: authHeaders(token) }
    )
  }

  // Record journey metrics
  journeyComplete.add(journeyOk)
  journeyDuration.add(Date.now() - journeyStart)

  sleep(2)
}
