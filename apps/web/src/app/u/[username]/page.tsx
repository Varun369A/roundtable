import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

interface PassportSkill {
  id: string
  skillName: string
  category: string
  level: string
  endorsements: number
  isVisible: boolean
}

interface PassportAchievement {
  id: string
  title: string
  description: string
  badgeIcon: string
  awardedAt: string
  category: string
  isVisible: boolean
}

interface PassportShowcase {
  id: string
  taskId: string
  displayTitle?: string
  displayDescription?: string
  order: number
}

interface PassportData {
  id: string
  username: string
  displayName?: string
  headline?: string
  bio?: string
  avatarUrl?: string
  location?: string
  website?: string
  linkedinUrl?: string
  twitterHandle?: string
  reputationScore: number
  viewCount: number
  isPublic: boolean
  skills: PassportSkill[]
  achievements: PassportAchievement[]
  showcases: PassportShowcase[]
  user?: {
    name: string
    createdAt: string
  }
  stats: {
    taskCount: number
    reposCount: number
    friendsCount: number
  }
}

async function getPassport(username: string): Promise<PassportData | null> {
  try {
    const res = await fetch(`${API_URL}/u/${encodeURIComponent(username)}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const data = await getPassport(params.username)
  if (!data) return { title: 'Profile Not Found | Arivarangam' }

  const name = data.displayName || data.user?.name || params.username
  const description =
    data.bio || data.headline || `${name}'s digital passport on Arivarangam platform`

  return {
    title: `${name} (@${data.username}) | Arivarangam`,
    description,
    openGraph: {
      title: `${name} | Arivarangam Digital Passport`,
      description,
      type: 'profile',
      images: [
        {
          url: `${API_URL}/u/${data.username}/og-image`,
          width: 1200,
          height: 630,
          alt: `${name}'s Arivarangam Profile`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Arivarangam`,
      description,
      images: [`${API_URL}/u/${data.username}/og-image`],
    },
  }
}

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: 'bg-gray-100 text-gray-700',
  INTERMEDIATE: 'bg-blue-100 text-blue-700',
  ADVANCED: 'bg-purple-100 text-purple-800',
  EXPERT: 'bg-orange-100 text-orange-800',
  MASTER: 'bg-amber-100 text-amber-800',
}

const CATEGORY_ICONS: Record<string, string> = {
  CODE: '💻',
  CONTENT: '✍️',
  DESIGN: '🎨',
  STRATEGY: '📊',
  RESEARCH: '🔬',
  MIXED: '⚡',
  LEADERSHIP: '🏆',
  COMMUNICATION: '💬',
}

export default async function PublicPassportPage({
  params,
}: {
  params: { username: string }
}) {
  const data = await getPassport(params.username)

  if (!data) notFound()

  const name = data.displayName || data.user?.name || data.username
  const memberSince = data.user?.createdAt
    ? new Date(data.user.createdAt).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })
    : null

  const visibleSkills = data.skills.filter((s) => s.isVisible)
  const visibleAchievements = data.achievements.filter((a) => a.isVisible)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900 tracking-tight">
            Arivarangam
          </Link>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700" />

          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12 mb-4">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.avatarUrl}
                  alt={name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full border-4 border-white shadow object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-white shadow bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white font-bold text-2xl">
                  {name[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">@{data.username}</p>

            {data.headline && (
              <p className="text-gray-700 font-medium mt-2">{data.headline}</p>
            )}
            {data.bio && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">{data.bio}</p>
            )}

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
              {data.location && <span>📍 {data.location}</span>}
              {data.website && (
                <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  🌐 Website
                </a>
              )}
              {data.linkedinUrl && (
                <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  in LinkedIn
                </a>
              )}
              {data.twitterHandle && (
                <a href={`https://x.com/${data.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                  𝕏 @{data.twitterHandle}
                </a>
              )}
              {memberSince && <span>Joined {memberSince}</span>}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
              {[
                { label: 'Tasks Done', value: data.stats.taskCount },
                { label: 'Repos', value: data.stats.reposCount },
                { label: 'Connections', value: data.stats.friendsCount },
                { label: 'Reputation', value: data.reputationScore },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-bold text-gray-900">{s.value.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Featured Work */}
            {data.showcases.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Featured Work</h2>
                <div className="space-y-3">
                  {data.showcases
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <div key={s.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {s.displayTitle || 'Featured task'}
                        </h3>
                        {s.displayDescription && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {s.displayDescription}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {visibleSkills.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Skills</h2>
                <div className="space-y-3">
                  {visibleSkills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">
                          {CATEGORY_ICONS[skill.category] || '⚡'}
                        </span>
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {skill.skillName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {skill.endorsements > 0 && (
                          <span className="text-xs text-gray-400 hidden sm:block">
                            {skill.endorsements} endorsements
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-semibold ${LEVEL_COLORS[skill.level] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {skill.level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Achievements */}
            {visibleAchievements.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Achievements</h2>
                <div className="space-y-4">
                  {visibleAchievements.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
                        {a.badgeIcon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(a.awardedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-6 text-white">
              <p className="font-semibold mb-1">Build with AI on Arivarangam</p>
              <p className="text-gray-300 text-sm mb-4">
                Join {name} and thousands of professionals using Arivarangam to accomplish ambitious goals.
              </p>
              <Link
                href="/register"
                className="block text-center px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Arivarangam. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/about" className="hover:text-gray-700">About</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
