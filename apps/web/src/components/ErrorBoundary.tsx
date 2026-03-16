'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary — catches render-time JS errors and shows a fallback UI
 * instead of crashing the whole page.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <MyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info)
    this.props.onError?.(error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
          <div className="text-3xl mb-3">⚠</div>
          <h3 className="text-lg font-semibold text-white mb-1">Something went wrong</h3>
          <p className="text-sm text-zinc-400 mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Minimal fallback for critical sections where a full error message is
 * inappropriate (e.g., a single card in a grid).
 */
export function MinimalErrorFallback() {
  return (
    <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400">
      Failed to load this section.
    </div>
  )
}
