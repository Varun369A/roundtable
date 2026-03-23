'use client'

import { useState } from 'react'
import Link from 'next/link'

const BLOG_POSTS = [
  {
    slug: 'discussion-engine-how-it-works',
    title: "How Arivarangam's Discussion Engine Makes AI 3x Smarter",
    date: '2025-03-10',
    category: 'Product',
    readTime: '6 min',
    excerpt: "We designed a 3-round peer review system where each AI critiques the others. Here's why it produces dramatically better results.",
  },
  {
    slug: 'byoai-guide',
    title: 'BYOAI: Use Claude for Free with Your Own API Keys',
    date: '2025-03-05',
    category: 'Guide',
    readTime: '4 min',
    excerpt: 'Connect your own Anthropic, OpenAI, or Google API keys to Arivarangam and use them without spending Arivarangam credits.',
  },
  {
    slug: 'sarvam-voice-input',
    title: 'Speak to Your AI in Hindi, Tamil, Telugu and More',
    date: '2025-02-28',
    category: 'Feature',
    readTime: '3 min',
    excerpt: 'Arivarangam now supports 10 Indian languages for voice input, powered by Sarvam AI. Here\'s how to use it.',
  },
  {
    slug: 'india-ai-market-2025',
    title: 'Why India Needs Its Own AI Platform',
    date: '2025-02-20',
    category: 'Insight',
    readTime: '8 min',
    excerpt: 'Dollar-denominated AI pricing, poor Indian language support, and Western-centric defaults have left Indian professionals underserved.',
  },
  {
    slug: 'ai-firewall-pii-protection',
    title: 'How Arivarangam Protects Your Data Before It Reaches Any AI',
    date: '2025-02-15',
    category: 'Security',
    readTime: '5 min',
    excerpt: 'Our AI Firewall automatically redacts Aadhaar numbers, PAN cards, phone numbers, and other PII before sending to AI providers.',
  },
]

const CATEGORIES = ['All', 'Product', 'Guide', 'Feature', 'Insight', 'Security']

const CATEGORY_STYLES: Record<string, string> = {
  Product:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  Guide:    'bg-amber-500/15 text-amber-300 border-amber-500/20',
  Feature:  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  Insight:  'bg-purple-500/15 text-purple-300 border-purple-500/20',
  Security: 'bg-green-500/15 text-green-300 border-green-500/20',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter((p) => p.category === activeCategory)

  const featured = filtered[0]
  const rest = filtered.slice(1)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Arivarangam<span className="text-indigo-400">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-zinc-100 transition-colors">Changelog</Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-10 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-medium mb-6">
            Latest writing
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Arivarangam Blog</h1>
          <p className="text-zinc-400">
            Product updates, engineering deep dives, and guides for India's AI-native professionals.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <div className="px-6 pb-8">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-zinc-500 py-12">No posts in this category yet.</p>
          ) : (
            <>
              {/* Featured post */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="block mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors overflow-hidden group"
                >
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[featured.category] || 'bg-zinc-700 text-zinc-300'}`}>
                        {featured.category}
                      </span>
                      <time className="text-xs text-zinc-500">{formatDate(featured.date)}</time>
                      <span className="text-xs text-zinc-600">{featured.readTime} read</span>
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-100 mb-3 leading-tight group-hover:text-indigo-300 transition-colors">
                      {featured.title}
                    </h2>
                    <p className="text-zinc-400 leading-relaxed max-w-2xl">{featured.excerpt}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm text-indigo-400 font-medium mt-4">
                      Read article →
                    </span>
                  </div>
                </Link>
              )}

              {/* Remaining posts grid */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {rest.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors p-6 flex flex-col gap-4 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[post.category] || 'bg-zinc-700 text-zinc-300'}`}>
                          {post.category}
                        </span>
                        <time className="text-xs text-zinc-500">{formatDate(post.date)}</time>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-zinc-100 mb-2 leading-snug group-hover:text-indigo-300 transition-colors">
                          {post.title}
                        </h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">{post.excerpt}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-zinc-600">{post.readTime} read</span>
                        <span className="text-sm text-indigo-400 font-medium">Read →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Pagination placeholder */}
              <div className="mt-10 text-center">
                <button
                  disabled
                  className="px-6 py-2.5 border border-zinc-800 text-zinc-600 rounded-xl text-sm cursor-not-allowed"
                >
                  More articles coming soon
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 px-6 border-t border-zinc-800 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-2">Stay in the loop</h2>
          <p className="text-zinc-400 text-sm mb-6">
            New posts every week. Product updates, guides, and AI news from an Indian perspective.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shrink-0">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        <div className="flex flex-wrap items-center justify-center gap-6 mb-3">
          <Link href="/features" className="hover:text-zinc-300 transition-colors">Features</Link>
          <Link href="/changelog" className="hover:text-zinc-300 transition-colors">Changelog</Link>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
