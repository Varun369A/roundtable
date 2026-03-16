import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import FeedbackWidget from '@/components/FeedbackWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sabha — One Platform. Every AI.',
  description: 'The AI operating system. All models, one roundtable. Pay once.',
  keywords: ['AI', 'artificial intelligence', 'ChatGPT', 'Claude', 'Gemini', 'automation'],
  openGraph: {
    title: 'Sabha — One Platform. Every AI.',
    description: 'The AI operating system. All models, one roundtable. Pay once.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  )
}
