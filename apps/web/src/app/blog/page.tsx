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
  Product:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  Guide:    'bg-amber-50 text-amber-700 border-amber-200',
  Feature:  'bg-blue-50 text-blue-700 border-blue-200',
  Insight:  'bg-purple-50 text-purple-700 border-purple-200',
  Security: 'bg-green-50 text-green-700 border-green-200',
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/features" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-slate-900 transition-colors">Changelog</Link>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600 text-xs font-medium mb-6">
            Latest writing
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900">Arivarangam Blog</h1>
          <p className="text-slate-500">
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
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
            <p className="text-center text-slate-400 py-12">No posts in this category yet.</p>
          ) : (
            <>
              {/* Featured post */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="block mb-8 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors overflow-hidden group shadow-sm"
                >
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[featured.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {featured.category}
                      </span>
                      <time className="text-xs text-slate-400">{formatDate(featured.date)}</time>
                      <span className="text-xs text-slate-400">{featured.readTime} read</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3 leading-tight group-hover:text-indigo-600 transition-colors">
                      {featured.title}
                    </h2>
                    <p className="text-slate-500 leading-relaxed max-w-2xl">{featured.excerpt}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium mt-4">
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
                      className="block rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors p-6 flex flex-col gap-4 group shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[post.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {post.category}
                        </span>
                        <time className="text-xs text-slate-400">{formatDate(post.date)}</time>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-slate-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors">
                          {post.title}
                        </h2>
                        <p className="text-sm text-slate-500 leading-relaxed">{post.excerpt}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-slate-400">{post.readTime} read</span>
                        <span className="text-sm text-indigo-600 font-medium">Read →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Pagination placeholder */}
              <div className="mt-10 text-center">
                <button
                  disabled
                  className="px-6 py-2.5 border border-slate-200 text-slate-400 rounded-xl text-sm cursor-not-allowed bg-white"
                >
                  More articles coming soon
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 px-6 border-t border-slate-200 bg-white text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-slate-900">Stay in the loop</h2>
          <p className="text-slate-500 text-sm mb-6">
            New posts every week. Product updates, guides, and AI news from an Indian perspective.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shrink-0">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-200 bg-white text-center text-sm text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-6 mb-3">
          <Link href="/features" className="hover:text-slate-700 transition-colors">Features</Link>
          <Link href="/changelog" className="hover:text-slate-700 transition-colors">Changelog</Link>
          <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
