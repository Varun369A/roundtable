import type { Metadata } from 'next'
import { PricingFaqJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Pricing — Arivarangam AI',
  description: 'Simple credit-based pricing. 100 free credits on signup. Buy credits once, use for any task. 8 specialist AIs included. No subscriptions. Indian pricing.',
  openGraph: {
    title: 'Arivarangam AI Pricing — Pay per use, no subscriptions',
    description: '100 free credits on signup. ₹500/₹1,000/₹2,500/₹5,000 credit packs. All 8 specialist AIs included. Credits never expire.',
    images: [{ url: '/og-pricing.png', width: 1200, height: 630 }],
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PricingFaqJsonLd />
      {children}
    </>
  )
}
