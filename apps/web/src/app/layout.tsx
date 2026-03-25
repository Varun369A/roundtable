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
    default: 'Arivarangam — AI Platform for Web Development, App Development & Business',
    template: '%s | Arivarangam',
  },
  description: 'Build websites, mobile apps, marketing campaigns, and business strategies using Claude, GPT-4o, Gemini and 10+ AI specialists working together. Free to start. Made for India.',
  keywords: [
    // Core service keywords people actually search
    'AI web development', 'AI app development', 'AI mobile app builder',
    'website development AI', 'software development AI tool',
    'AI for developers', 'AI coding assistant', 'build web app with AI',
    // Business use cases
    'AI marketing tool', 'AI content creation', 'AI business strategy',
    'AI for startups', 'AI for freelancers', 'AI productivity tool',
    // Comparison / discovery
    'ChatGPT alternative India', 'AI platform India', 'multi AI platform',
    'Claude GPT Gemini together', 'best AI tool for developers India',
    // Brand
    'Arivarangam', 'Arivarangam AI', 'AI roundtable',
  ],
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
    title: 'Arivarangam — AI Platform for Web Development, App Development & Business',
    description: 'Build websites, mobile apps, marketing campaigns and more. Claude, GPT-4o, Gemini and 10+ AI specialists work together on your goals. Free to start.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Arivarangam — AI Platform for Web & App Development' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arivarangam — AI Platform for Web Development, App Development & Business',
    description: 'Build websites, mobile apps, marketing campaigns and more. Claude, GPT-4o, Gemini and 10+ AI specialists work together. Free to start.',
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
