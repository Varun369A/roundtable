import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Models — Browse 15+ AI Models',
  description: 'Browse Claude, GPT-4, Gemini, Midjourney, Perplexity and 10+ AI models on Arivarangam. Compare capabilities, pricing, and use cases.',
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
