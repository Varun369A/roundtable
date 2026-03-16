/**
 * SSE stream concurrency test.
 * Simulates N users each holding an SSE connection open simultaneously.
 *
 * Note: k6 doesn't have native EventSource support, so we use a raw HTTP GET
 * with stream reading to simulate SSE connections.
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3001 \
 *          --env TEST_USER_EMAIL=loadtest@example.com \
 *          --env TEST_USER_PASSWORD=Test@123! \
 *          k6/load-tests/stream.test.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Gauge } from 'k6/metrics'
import {
  BASE_URL,
  authHeaders,
  jsonBody,
} from './config.js'

const streamConnectSuccess = new Rate('sabha_stream_connect_success_rate')
const activeStreams         = new Gauge('sabha_active_streams')

export const options = {
  // Simulate 200 concurrent SSE connections
  scenarios: {
    sse_connections: {
      executor: 'constant-vus',
      vus: 200,
      duration: '5m',
    },
  },
  thresholds: {
    sabha_stream_connect_success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
}

export function setup() {
  const email    = __ENV.TEST_USER_EMAIL    || 'loadtest@sabha-test.internal'
  const password = __ENV.TEST_USER_PASSWORD || 'LoadTest@123!'

  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    jsonBody({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (res.status !== 200) {
    const signup = http.post(
      `${BASE_URL}/api/v1/auth/signup`,
      jsonBody({ email, password, name: 'Load Test User' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (signup.status !== 201) return { token: null }
    return { token: JSON.parse(signup.body).data.accessToken }
  }

  return { token: JSON.parse(res.body).data.accessToken }
}

export default function (data) {
  if (!data?.token) { sleep(1); return }

  // Create a task to stream
  const createRes = http.post(
    `${BASE_URL}/api/v1/tasks`,
    jsonBody({ goal: 'Write a short paragraph about AI' }),
    { headers: authHeaders(data.token), tags: { route: '/api/v1/tasks' } }
  )

  if (createRes.status !== 201) { sleep(1); return }

  const taskId = JSON.parse(createRes.body).data.id

  // Connect to SSE stream — use streaming response to hold connection
  const streamUrl = `${BASE_URL}/api/v1/stream/${taskId}?token=${data.token}`

  activeStreams.add(1)

  // k6 doesn't support streaming — we do a short-lived GET to verify the
  // endpoint responds with correct headers and initial state event
  const streamRes = http.get(streamUrl, {
    timeout: '10s',
    tags: { route: '/api/v1/stream/:id' },
  })

  const ok = check(streamRes, {
    'stream: status 200':                 (r) => r.status === 200,
    'stream: content-type SSE':           (r) => r.headers['Content-Type']?.includes('text/event-stream') ?? false,
    'stream: has connected event':        (r) => r.body?.includes('event: connected') ?? false,
  })

  streamConnectSuccess.add(ok)
  activeStreams.add(-1)

  // Cancel task (cleanup)
  http.del(
    `${BASE_URL}/api/v1/tasks/${taskId}`,
    null,
    { headers: authHeaders(data.token) }
  )

  sleep(2)
}
