'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Next.js App Router global error boundary.
 * Shown when any page throws an unhandled error.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to console (swap for a real error tracker in production)
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">⚠</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Something went wrong</h1>
          <p className="text-slate-500 mb-2 text-sm">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
