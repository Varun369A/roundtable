/**
 * Task CRUD + orchestration load test.
 * Tests: create task → list tasks → get task → start task → poll status
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3001 \
 *          --env TEST_USER_EMAIL=loadtest@example.com \
 *          --env TEST_USER_PASSWORD=Test@123! \
 *          k6/load-tests/tasks.test.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import {
  BASE_URL,
  STAGES_LOAD,
  THRESHOLDS_STRICT,
  authHeaders,
  jsonBody,
} from './config.js'

const taskCreateSuccess = new Rate('sabha_task_create_success_rate')
const taskListSuccess   = new Rate('sabha_task_list_success_rate')
const taskCreateLatency = new Trend('sabha_task_create_latency_ms')

export const options = {
  stages: STAGES_LOAD,
  thresholds: {
    ...THRESHOLDS_STRICT,
    sabha_task_create_success_rate: ['rate>0.99'],
    sabha_task_create_latency_ms:   ['p(95)<500'],
  },
}

// Pre-login setup — runs once per VU before the main function
export function setup() {
  const email    = __ENV.TEST_USER_EMAIL    || 'loadtest@sabha-test.internal'
  const password = __ENV.TEST_USER_PASSWORD || 'LoadTest@123!'

  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    jsonBody({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (res.status !== 200) {
    // Attempt signup if login fails (first run)
    const signup = http.post(
      `${BASE_URL}/api/v1/auth/signup`,
      jsonBody({ email, password, name: 'Load Test User' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (signup.status !== 201) {
      console.error(`Setup failed: ${signup.body}`)
      return { token: null }
    }
    return { token: JSON.parse(signup.body).data.accessToken }
  }

  return { token: JSON.parse(res.body).data.accessToken }
}

const SAMPLE_GOALS = [
  'Write a blog post about AI trends in 2025',
  'Create a marketing strategy for a fitness app',
  'Research competitor analysis for a B2B SaaS startup',
  'Write product descriptions for 5 e-commerce items',
  'Summarize the key benefits of renewable energy',
  'Draft a press release for a product launch',
  'Create social media captions for a fashion brand',
  'Write a technical spec for a REST API',
]

export default function (data) {
  if (!data?.token) {
    sleep(1)
    return
  }

  const headers = authHeaders(data.token)
  const goal = SAMPLE_GOALS[__ITER % SAMPLE_GOALS.length]
  let taskId = null

  // ── Create Task ──────────────────────────────────────────────────────────────
  group('create_task', () => {
    const start = Date.now()
    const res = http.post(
      `${BASE_URL}/api/v1/tasks`,
      jsonBody({ goal }),
      { headers, tags: { route: '/api/v1/tasks' } }
    )
    taskCreateLatency.add(Date.now() - start)

    const ok = check(res, {
      'create_task: status 201':  (r) => r.status === 201,
      'create_task: has id':      (r) => !!JSON.parse(r.body || '{}')?.data?.id,
      'create_task: status PENDING': (r) => JSON.parse(r.body || '{}')?.data?.status === 'PENDING',
    })
    taskCreateSuccess.add(ok)

    if (ok) {
      taskId = JSON.parse(res.body).data.id
    }
  })

  sleep(0.5)

  // ── List Tasks ───────────────────────────────────────────────────────────────
  group('list_tasks', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/tasks?page=1&limit=10`,
      { headers, tags: { route: '/api/v1/tasks' } }
    )
    const ok = check(res, {
      'list_tasks: status 200': (r) => r.status === 200,
      'list_tasks: has data':   (r) => Array.isArray(JSON.parse(r.body || '{}')?.data),
    })
    taskListSuccess.add(ok)
  })

  if (!taskId) {
    sleep(1)
    return
  }

  sleep(0.3)

  // ── Get Task ─────────────────────────────────────────────────────────────────
  group('get_task', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/tasks/${taskId}`,
      { headers, tags: { route: '/api/v1/tasks/:id' } }
    )
    check(res, {
      'get_task: status 200': (r) => r.status === 200,
      'get_task: correct id': (r) => JSON.parse(r.body || '{}')?.data?.id === taskId,
    })
  })

  sleep(0.3)

  // ── Start Orchestration ──────────────────────────────────────────────────────
  group('start_task', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/tasks/${taskId}/start`,
      null,
      { headers, tags: { route: '/api/v1/tasks/:id/start' } }
    )
    check(res, {
      'start_task: status 202': (r) => r.status === 202,
    })
  })

  sleep(1)

  // ── Poll for ROUTING status ──────────────────────────────────────────────────
  group('poll_task_status', () => {
    let attempts = 0
    while (attempts < 5) {
      const res = http.get(
        `${BASE_URL}/api/v1/tasks/${taskId}`,
        { headers, tags: { route: '/api/v1/tasks/:id' } }
      )
      if (res.status === 200) {
        const status = JSON.parse(res.body)?.data?.status
        if (status !== 'PENDING') break
      }
      sleep(1)
      attempts++
    }
  })

  // ── Cancel Task (cleanup) ────────────────────────────────────────────────────
  group('cancel_task', () => {
    http.del(
      `${BASE_URL}/api/v1/tasks/${taskId}`,
      null,
      { headers, tags: { route: '/api/v1/tasks/:id' } }
    )
  })

  sleep(1)
}
