import type { Metadata } from 'next'
import Link from 'next/link'

const BLOG_POSTS: Record<string, { title: string; date: string; category: string; readTime: string; excerpt: string }> = {
  'discussion-engine-how-it-works': {
    title: "How Sabha's Discussion Engine Makes AI 3x Smarter",
    date: '2025-03-10',
    category: 'Product',
    readTime: '6 min',
    excerpt: "We designed a 3-round peer review system where each AI critiques the others. Here's why it produces dramatically better results.",
  },
  'byoai-guide': {
    title: 'BYOAI: Use Claude for Free with Your Own API Keys',
    date: '2025-03-05',
    category: 'Guide',
    readTime: '4 min',
    excerpt: 'Connect your own Anthropic, OpenAI, or Google API keys to Sabha and use them without spending Sabha credits.',
  },
  'sarvam-voice-input': {
    title: 'Speak to Your AI in Hindi, Tamil, Telugu and More',
    date: '2025-02-28',
    category: 'Feature',
    readTime: '3 min',
    excerpt: 'Sabha now supports 10 Indian languages for voice input, powered by Sarvam AI. Here\'s how to use it.',
  },
  'india-ai-market-2025': {
    title: 'Why India Needs Its Own AI Platform',
    date: '2025-02-20',
    category: 'Insight',
    readTime: '8 min',
    excerpt: 'Dollar-denominated AI pricing, poor Indian language support, and Western-centric defaults have left Indian professionals underserved.',
  },
  'ai-firewall-pii-protection': {
    title: 'How Sabha Protects Your Data Before It Reaches Any AI',
    date: '2025-02-15',
    category: 'Security',
    readTime: '5 min',
    excerpt: 'Our AI Firewall automatically redacts Aadhaar numbers, PAN cards, phone numbers, and other PII before sending to AI providers.',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = BLOG_POSTS[slug]

  if (!post) {
    return { title: 'Blog — Sabha AI' }
  }

  return {
    title: `${post.title} — Sabha Blog`,
    description: post.excerpt,
    alternates: { canonical: `https://sabhaai.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
    },
  }
}

export function generateStaticParams() {
  return Object.keys(BLOG_POSTS).map((slug) => ({ slug }))
}

const CATEGORY_STYLES: Record<string, string> = {
  Product:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  Guide:    'bg-amber-500/15 text-amber-300 border-amber-500/20',
  Feature:  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  Insight:  'bg-purple-500/15 text-purple-300 border-purple-500/20',
  Security: 'bg-green-500/15 text-green-300 border-green-500/20',
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = BLOG_POSTS[slug]

  const formattedDate = post
    ? new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Sabha<span className="text-indigo-400">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/blog" className="hover:text-zinc-100 transition-colors">← Blog</Link>
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-32 pb-24">
        {post ? (
          <>
            {/* Post header */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[post.category] || 'bg-zinc-700 text-zinc-300'}`}>
                  {post.category}
                </span>
                <time className="text-sm text-zinc-500">{formattedDate}</time>
                <span className="text-sm text-zinc-600">{post.readTime} read</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight leading-tight mb-4">{post.title}</h1>
              <p className="text-lg text-zinc-400 leading-relaxed">{post.excerpt}</p>
            </div>

            {/* Coming soon notice */}
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 text-center">
              <div className="text-4xl mb-4">✍️</div>
              <h2 className="text-xl font-bold text-white mb-3">Full article coming soon</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                This article is being written. Subscribe to be notified when it publishes — along with all future Sabha blog posts.
              </p>
              <div className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 transition-colors"
                />
                <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white transition-colors whitespace-nowrap">
                  Notify me
                </button>
              </div>
            </div>

            {/* Other posts */}
            <div className="mt-12">
              <p className="text-sm font-semibold text-zinc-400 mb-4">Other articles</p>
              <div className="space-y-3">
                {Object.entries(BLOG_POSTS)
                  .filter(([s]) => s !== slug)
                  .slice(0, 3)
                  .map(([s, p]) => (
                    <Link
                      key={s}
                      href={`/blog/${s}`}
                      className="flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group"
                    >
                      <span className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_STYLES[p.category] || 'bg-zinc-700 text-zinc-300'}`}>
                        {p.category}
                      </span>
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors leading-snug">
                        {p.title}
                      </span>
                    </Link>
                  ))}
              </div>
              <Link href="/blog" className="inline-block mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                View all articles →
              </Link>
            </div>
          </>
        ) : (
          /* 404-style fallback for unknown slugs */
          <div className="text-center py-20">
            <div className="text-5xl mb-6">📝</div>
            <h1 className="text-2xl font-bold mb-3">Article not found</h1>
            <p className="text-zinc-400 mb-8">This article doesn't exist or may have been moved.</p>
            <Link href="/blog" className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors">
              Back to blog
            </Link>
          </div>
        )}
      </main>

      <footer className="py-10 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} Sabha AI. <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link> · <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link> · <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link></p>
      </footer>
    </div>
  )
}
