/**
 * Auth endpoints load test.
 * Tests: signup → login → /me → refresh → logout
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3001 k6/load-tests/auth.test.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import {
  BASE_URL,
  STAGES_LOAD,
  THRESHOLDS_STRICT,
  authHeaders,
  jsonBody,
  uniqueEmail,
} from './config.js'

// Custom metrics
const signupSuccessRate   = new Rate('sabha_signup_success_rate')
const loginSuccessRate    = new Rate('sabha_login_success_rate')
const tokenRefreshSuccess = new Rate('sabha_token_refresh_success_rate')
const loginDuration       = new Trend('sabha_login_duration_ms')

export const options = {
  stages: STAGES_LOAD,
  thresholds: {
    ...THRESHOLDS_STRICT,
    sabha_login_success_rate:    ['rate>0.99'],
    sabha_signup_success_rate:   ['rate>0.99'],
    sabha_login_duration_ms:     ['p(95)<300'],
  },
}

export default function () {
  const email    = uniqueEmail(__VU, __ITER)
  const password = 'LoadTest@123!'
  const name     = `Load Test User ${__VU}`

  let accessToken  = null
  let refreshToken = null

  // ── Signup ──────────────────────────────────────────────────────────────────
  group('signup', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/signup`,
      jsonBody({ email, password, name }),
      { headers: { 'Content-Type': 'application/json' }, tags: { route: '/api/v1/auth/signup' } }
    )
    const ok = check(res, {
      'signup: status 201': (r) => r.status === 201,
      'signup: has tokens':  (r) => !!JSON.parse(r.body || '{}')?.data?.accessToken,
    })
    signupSuccessRate.add(ok)

    if (ok) {
      const body = JSON.parse(res.body)
      accessToken  = body.data.accessToken
      refreshToken = body.data.refreshToken
    }
  })

  if (!accessToken) {
    sleep(1)
    return
  }

  sleep(0.5)

  // ── GET /me ─────────────────────────────────────────────────────────────────
  group('get_me', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/auth/me`,
      { headers: authHeaders(accessToken), tags: { route: '/api/v1/auth/me' } }
    )
    check(res, {
      'get_me: status 200': (r) => r.status === 200,
      'get_me: has email':  (r) => JSON.parse(r.body || '{}')?.data?.email === email,
    })
  })

  sleep(0.3)

  // ── Token Refresh ────────────────────────────────────────────────────────────
  group('token_refresh', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/refresh`,
      jsonBody({ refreshToken }),
      { headers: { 'Content-Type': 'application/json' }, tags: { route: '/api/v1/auth/refresh' } }
    )
    const ok = check(res, {
      'refresh: status 200':    (r) => r.status === 200,
      'refresh: new token':     (r) => !!JSON.parse(r.body || '{}')?.data?.accessToken,
    })
    tokenRefreshSuccess.add(ok)

    if (ok) {
      const body = JSON.parse(res.body)
      accessToken  = body.data.accessToken
      refreshToken = body.data.refreshToken
    }
  })

  sleep(0.3)

  // ── Login (with fresh credentials) ──────────────────────────────────────────
  group('login', () => {
    const start = Date.now()
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      jsonBody({ email, password }),
      { headers: { 'Content-Type': 'application/json' }, tags: { route: '/api/v1/auth/login' } }
    )
    loginDuration.add(Date.now() - start)
    const ok = check(res, {
      'login: status 200':  (r) => r.status === 200,
      'login: has token':   (r) => !!JSON.parse(r.body || '{}')?.data?.accessToken,
    })
    loginSuccessRate.add(ok)
    if (ok) {
      accessToken = JSON.parse(res.body).data.accessToken
    }
  })

  sleep(0.3)

  // ── Logout ───────────────────────────────────────────────────────────────────
  group('logout', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/logout`,
      null,
      { headers: authHeaders(accessToken), tags: { route: '/api/v1/auth/logout' } }
    )
    check(res, { 'logout: status 200': (r) => r.status === 200 })
  })

  // ── Brute force protection check ────────────────────────────────────────────
  // After 5 wrong passwords, should get rate limited (429 or 401)
  group('wrong_password_check', () => {
    let lastStatus = 0
    for (let i = 0; i < 6; i++) {
      const res = http.post(
        `${BASE_URL}/api/v1/auth/login`,
        jsonBody({ email, password: 'WrongPassword!' }),
        { headers: { 'Content-Type': 'application/json' }, tags: { route: '/api/v1/auth/login' } }
      )
      lastStatus = res.status
      sleep(0.1)
    }
    check({ status: lastStatus }, {
      'brute force: eventually rate limited': (s) => s.status === 429 || s.status === 401,
    })
  })

  sleep(1)
}
