import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import FeedbackWidget from '@/components/FeedbackWidget'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import SessionExpiryWarning from '@/components/auth/SessionExpiryWarning'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://sabhaai.com'),
  title: {
    default: 'Sabha — One Platform. Every AI.',
    template: '%s | Sabha',
  },
  description: 'Sabha coordinates Claude, GPT-4, Gemini, Midjourney and 10+ AI models to complete your goals together. The AI roundtable for Indian professionals.',
  keywords: ['AI platform', 'multi AI', 'ChatGPT alternative', 'Claude AI', 'AI automation', 'Sabha AI', 'Indian AI platform'],
  authors: [{ name: 'Sabha AI' }],
  creator: 'Sabha AI',
  publisher: 'Sabha AI',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://sabhaai.com',
    siteName: 'Sabha',
    title: 'Sabha — One Platform. Every AI.',
    description: 'Coordinate Claude, GPT-4, Gemini and 10+ AIs on one roundtable. Built for India.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Sabha — One Platform. Every AI.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sabha — One Platform. Every AI.',
    description: 'Coordinate Claude, GPT-4, Gemini and 10+ AIs on one roundtable. Built for India.',
    images: ['/og-image.png'],
    creator: '@sabhaai',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  alternates: {
    canonical: 'https://sabhaai.com',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <GoogleAnalytics />
        {children}
        <FeedbackWidget />
        <SessionExpiryWarning />
      </body>
    </html>
  )
}
