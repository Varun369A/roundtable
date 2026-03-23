# Arivarangam Load Tests (k6)

## Prerequisites

```bash
# Install k6
# macOS:
brew install k6

# Linux:
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows:
winget install k6
```

## Test Files

| File              | What it tests                              | Duration  |
|-------------------|--------------------------------------------|-----------|
| `auth.test.js`    | Signup, login, refresh, logout, brute force| ~10m load |
| `tasks.test.js`   | Task CRUD, orchestration start, polling    | ~10m load |
| `stream.test.js`  | 200 concurrent SSE connections             | 5m        |
| `full-flow.test.js` | Complete user journey end-to-end         | ~10m load |

## Running Tests

```bash
# 1. Make sure the Arivarangam API is running:
cd sabha && npm run dev

# 2. Smoke test (1 VU, 30s — quick sanity check)
k6 run --env BASE_URL=http://localhost:3001 --env SCENARIO=smoke k6/load-tests/auth.test.js

# 3. Load test (ramp to 100 VUs)
k6 run --env BASE_URL=http://localhost:3001 k6/load-tests/auth.test.js

# 4. Full journey load test
k6 run --env BASE_URL=http://localhost:3001 k6/load-tests/full-flow.test.js

# 5. SSE concurrency test (200 simultaneous connections)
k6 run --env BASE_URL=http://localhost:3001 \
       --env TEST_USER_EMAIL=loadtest@sabha-test.internal \
       --env TEST_USER_PASSWORD=LoadTest@123! \
       k6/load-tests/stream.test.js

# 6. Spike test (sudden burst to 1000 VUs)
k6 run --env BASE_URL=http://localhost:3001 --env SCENARIO=spike k6/load-tests/full-flow.test.js

# 7. Output to JSON for analysis
k6 run --out json=results/run-$(date +%Y%m%d-%H%M%S).json k6/load-tests/full-flow.test.js
```

## Key Metrics to Watch

| Metric                    | Target (p95) | Alarm threshold |
|---------------------------|--------------|-----------------|
| `http_req_duration`       | < 500ms      | > 1000ms        |
| `http_req_failed`         | < 1%         | > 5%            |
| `sabha_login_duration_ms` | < 300ms      | > 500ms         |
| `sabha_task_create_latency_ms` | < 500ms | > 1000ms       |
| `sabha_journey_complete_rate` | > 95%    | < 90%           |

## Interpreting Results

k6 prints a summary at the end of each run. Look for:

- `✓` checks = assertions passed
- `✗` checks = assertions failed — investigate immediately
- `http_req_duration` histogram — p95 and p99 are most important
- `http_req_failed rate` — should be near 0

## What to Do When Tests Fail

1. **High latency (p95 > 1s)**: Check DB query plans, Redis hit rate, and AI connector timeouts
2. **High error rate**: Check Fastify logs for 5xx errors, check BullMQ queue depth
3. **SSE connections dropping**: Check Redis pub/sub subscriber count, OS file descriptor limits
4. **Circuit breakers tripping**: Check AI connector logs, consider increasing `openDurationMs`
