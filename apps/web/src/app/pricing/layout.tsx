import type { Metadata } from 'next'
import { PricingFaqJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Pricing — Affordable AI Plans',
  description: 'Arivarangam pricing starting at ₹499/month. Free tier with 5 tasks. Unlimited AI models, all plans. No hidden fees.',
  openGraph: {
    title: 'Arivarangam Pricing — Start Free, Scale Affordably',
    description: 'Free tier available. Starter ₹499/mo, Pro ₹1299/mo, Power ₹2499/mo. Indian pricing, Razorpay.',
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
