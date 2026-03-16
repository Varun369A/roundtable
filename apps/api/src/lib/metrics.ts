/**
 * Lightweight in-process metrics store.
 * Exposes a Prometheus-compatible text format at GET /metrics.
 *
 * Tracks:
 *   - HTTP request counts and latencies (histogram)
 *   - AI connector call counts, latencies, error rates
 *   - BullMQ queue depths
 *   - Active SSE connections
 *   - Task/subtask completion rates
 */

type Labels = Record<string, string>

// ─── Counter ──────────────────────────────────────────────────────────────────

class Counter {
  private values = new Map<string, number>()

  inc(labels: Labels = {}, amount = 1): void {
    const key = serializeLabels(labels)
    this.values.set(key, (this.values.get(key) ?? 0) + amount)
  }

  get(labels: Labels = {}): number {
    return this.values.get(serializeLabels(labels)) ?? 0
  }

  toPrometheus(name: string, help: string): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`]
    for (const [labelStr, value] of this.values) {
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`)
    }
    return lines.join('\n')
  }
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

class Gauge {
  private values = new Map<string, number>()

  set(labels: Labels = {}, value: number): void {
    this.values.set(serializeLabels(labels), value)
  }

  inc(labels: Labels = {}, amount = 1): void {
    const key = serializeLabels(labels)
    this.values.set(key, (this.values.get(key) ?? 0) + amount)
  }

  dec(labels: Labels = {}, amount = 1): void {
    const key = serializeLabels(labels)
    this.values.set(key, Math.max(0, (this.values.get(key) ?? 0) - amount))
  }

  get(labels: Labels = {}): number {
    return this.values.get(serializeLabels(labels)) ?? 0
  }

  toPrometheus(name: string, help: string): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`]
    for (const [labelStr, value] of this.values) {
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${value}`)
    }
    return lines.join('\n')
  }
}

// ─── Histogram ────────────────────────────────────────────────────────────────
// Fixed buckets in milliseconds.

const HTTP_BUCKETS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
const AI_BUCKETS   = [100, 500, 1000, 2000, 5000, 10000, 30000, 60000]

class Histogram {
  private counts = new Map<string, number[]>()
  private sums   = new Map<string, number>()
  private totals = new Map<string, number>()

  constructor(private readonly buckets: number[]) {}

  observe(labels: Labels = {}, valueMs: number): void {
    const key = serializeLabels(labels)

    if (!this.counts.has(key)) {
      this.counts.set(key, new Array(this.buckets.length + 1).fill(0))
    }

    const buckets = this.counts.get(key)!
    for (let i = 0; i < this.buckets.length; i++) {
      if (valueMs <= this.buckets[i]) {
        buckets[i]++
      }
    }
    buckets[this.buckets.length]++ // +Inf

    this.sums.set(key, (this.sums.get(key) ?? 0) + valueMs)
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1)
  }

  toPrometheus(name: string, help: string): string {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`]

    for (const [labelStr, bucketCounts] of this.counts) {
      const labelPrefix = labelStr ? `${labelStr},` : ''

      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${name}_bucket{${labelPrefix}le="${this.buckets[i]}"} ${bucketCounts[i]}`)
      }
      lines.push(`${name}_bucket{${labelPrefix}le="+Inf"} ${bucketCounts[this.buckets.length]}`)

      const sum = this.sums.get(labelStr) ?? 0
      const total = this.totals.get(labelStr) ?? 0
      lines.push(`${name}_sum${labelStr ? `{${labelStr}}` : ''} ${sum}`)
      lines.push(`${name}_count${labelStr ? `{${labelStr}}` : ''} ${total}`)
    }

    return lines.join('\n')
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

class MetricsRegistry {
  // HTTP
  readonly httpRequestsTotal    = new Counter()
  readonly httpRequestDurationMs = new Histogram(HTTP_BUCKETS)
  readonly httpRequestsInFlight  = new Gauge()

  // AI Connectors
  readonly aiCallsTotal     = new Counter()
  readonly aiCallDurationMs = new Histogram(AI_BUCKETS)
  readonly aiCallErrors     = new Counter()
  readonly aiCircuitOpen    = new Gauge()
  readonly aiCostUsdTotal   = new Counter()

  // Tasks
  readonly tasksCreated   = new Counter()
  readonly tasksCompleted = new Counter()
  readonly tasksFailed    = new Counter()
  readonly subtasksRun    = new Counter()

  // SSE connections
  readonly sseConnectionsActive = new Gauge()

  // Queue depths (set externally)
  readonly queueDepth = new Gauge()

  // Auth
  readonly authFailures = new Counter()
  readonly authSuccesses = new Counter()

  collect(): string {
    const sections = [
      this.httpRequestsTotal.toPrometheus(
        'sabha_http_requests_total',
        'Total HTTP requests by method, route, status_code'
      ),
      this.httpRequestDurationMs.toPrometheus(
        'sabha_http_request_duration_ms',
        'HTTP request duration in milliseconds'
      ),
      this.httpRequestsInFlight.toPrometheus(
        'sabha_http_requests_in_flight',
        'Currently in-flight HTTP requests'
      ),
      this.aiCallsTotal.toPrometheus(
        'sabha_ai_calls_total',
        'Total AI connector calls by model'
      ),
      this.aiCallDurationMs.toPrometheus(
        'sabha_ai_call_duration_ms',
        'AI connector call latency in milliseconds'
      ),
      this.aiCallErrors.toPrometheus(
        'sabha_ai_call_errors_total',
        'Total AI connector errors by model and error_type'
      ),
      this.aiCircuitOpen.toPrometheus(
        'sabha_ai_circuit_open',
        '1 if circuit breaker is open for this model, 0 if closed'
      ),
      this.aiCostUsdTotal.toPrometheus(
        'sabha_ai_cost_usd_total',
        'Total AI API cost in USD by model (scaled x1000 as integer)'
      ),
      this.tasksCreated.toPrometheus('sabha_tasks_created_total', 'Total tasks created'),
      this.tasksCompleted.toPrometheus('sabha_tasks_completed_total', 'Total tasks completed'),
      this.tasksFailed.toPrometheus('sabha_tasks_failed_total', 'Total tasks failed'),
      this.subtasksRun.toPrometheus('sabha_subtasks_run_total', 'Total subtasks executed'),
      this.sseConnectionsActive.toPrometheus(
        'sabha_sse_connections_active',
        'Currently active SSE connections'
      ),
      this.queueDepth.toPrometheus('sabha_queue_depth', 'BullMQ queue depth by queue name'),
      this.authFailures.toPrometheus('sabha_auth_failures_total', 'Total authentication failures'),
      this.authSuccesses.toPrometheus('sabha_auth_successes_total', 'Total authentication successes'),
    ]

    return sections.join('\n\n') + '\n'
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status_code: String(statusCode) }
    this.httpRequestsTotal.inc(labels)
    this.httpRequestDurationMs.observe(labels, durationMs)
  }

  recordAiCall(model: string, durationMs: number, costUsd: number, success: boolean): void {
    this.aiCallsTotal.inc({ model, success: String(success) })
    this.aiCallDurationMs.observe({ model }, durationMs)
    if (!success) this.aiCallErrors.inc({ model })
    // Store cost scaled by 1000 to avoid float imprecision in counter
    if (costUsd > 0) this.aiCostUsdTotal.inc({ model }, Math.round(costUsd * 1000))
  }
}

export const metrics = new MetricsRegistry()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeLabels(labels: Labels): string {
  const entries = Object.entries(labels)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
