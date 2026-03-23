/**
 * OpenTelemetry distributed tracing for Arivarangam.
 *
 * Traces multi-hop Roundtable execution across AI providers:
 *   task_created → subtask_started (AI provider span) → subtask_completed
 *
 * In production: exports to Honeycomb / Grafana Tempo via OTLP.
 * In dev:        OTEL_EXPORTER_OTLP_ENDPOINT unset → no-op exporter (zero overhead).
 *
 * Installation:
 *   This file MUST be imported before any other module (including Fastify).
 *   In server.ts: import './lib/tracing' at the very top.
 *
 * Env vars:
 *   OTEL_SERVICE_NAME          default: "arivarangam-api"
 *   OTEL_EXPORTER_OTLP_ENDPOINT e.g. https://api.honeycomb.io
 *   OTEL_EXPORTER_OTLP_HEADERS e.g. x-honeycomb-team=<api-key>
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api'

const SERVICE_NAME    = process.env.OTEL_SERVICE_NAME    || 'arivarangam-api'
const SERVICE_VERSION = process.env.npm_package_version  || '1.0.0'
const OTLP_ENDPOINT   = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

// Only initialise the full SDK when an OTLP endpoint is configured.
// In dev with no endpoint the tracer API still works — all spans are no-ops.
if (OTLP_ENDPOINT) {
  const exporter = new OTLPTraceExporter()

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]:    SERVICE_NAME,
      [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    }),
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new PrismaInstrumentation(),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => sdk.shutdown().catch(console.error))
}

// ─── Tracer instance (use this everywhere in the codebase) ────────────────────

export const tracer = trace.getTracer(SERVICE_NAME)

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Wraps an async function in an OTel span.
 * On success: sets OK status. On error: records the exception + sets ERROR status.
 */
export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attrs)
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
      throw err
    } finally {
      span.end()
    }
  })
}

/**
 * Create a child span for a subtask execution.
 * Call this inside the subtask worker around connectorRegistry.execute().
 */
export function startSubtaskSpan(subtaskId: string, model: string, taskId: string): Span {
  return tracer.startSpan('subtask.execute', {
    attributes: {
      'sabha.task_id':    taskId,
      'sabha.subtask_id': subtaskId,
      'sabha.ai_model':   model,
    },
  })
}

export { context as otelContext }
