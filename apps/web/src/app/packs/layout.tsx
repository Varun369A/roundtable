import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vertical AI Packs — Legal, Medical, Finance & More',
  description: 'Pre-configured AI agent packs for specialized industries. Legal AI, Medical AI, Finance AI, Engineering AI. Built for Indian professionals.',
}

export default function PacksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
