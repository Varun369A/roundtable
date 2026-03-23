import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import FeedbackWidget from '@/components/FeedbackWidget'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import SessionExpiryWarning from '@/components/auth/SessionExpiryWarning'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://arivarangam.com'),
  title: {
    default: 'Arivarangam — One Platform. Every AI.',
    template: '%s | Arivarangam',
  },
  description: 'Arivarangam coordinates Claude, GPT-4, Gemini, Midjourney and 10+ AI models to complete your goals together. The AI roundtable for Indian professionals.',
  keywords: ['AI platform', 'multi AI', 'ChatGPT alternative', 'Claude AI', 'AI automation', 'Arivarangam', 'Indian AI platform'],
  authors: [{ name: 'Arivarangam' }],
  creator: 'Arivarangam',
  publisher: 'Arivarangam',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://arivarangam.com',
    siteName: 'Arivarangam',
    title: 'Arivarangam — One Platform. Every AI.',
    description: 'Coordinate Claude, GPT-4, Gemini and 10+ AIs on one roundtable. Built for India.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Arivarangam — One Platform. Every AI.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arivarangam — One Platform. Every AI.',
    description: 'Coordinate Claude, GPT-4, Gemini and 10+ AIs on one roundtable. Built for India.',
    images: ['/og-image.png'],
    creator: '@sabhaai',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  alternates: {
    canonical: 'https://arivarangam.com',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: [
      { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
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
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
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
