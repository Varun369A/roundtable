/**
 * Sentry error tracking initialization for the API server.
 *
 * Call initSentry() at the very top of server startup.
 * Import Sentry to capture exceptions manually: Sentry.captureException(err)
 */

import * as Sentry from '@sentry/node'

export function initSentry(): void {
  if (!process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Low sample rate in production to avoid volume charges; full tracing in dev
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Suppress events in development — log to console instead
      if (process.env.NODE_ENV === 'development') return null
      return event
    },
  })
}

export { Sentry }
