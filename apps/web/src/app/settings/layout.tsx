'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface NavItem {
  href: string
  label: string
  icon: string
  badge?: number
}

const STATIC_NAV: NavItem[] = [
  { href: '/settings/ai-connections', label: 'AI Connections', icon: '🔑' },
  { href: '/settings/roundtable',     label: 'My Roundtable',  icon: '⚙️' },
  { href: '/settings/memory',         label: 'Sabha Memory',   icon: '🧠' },
  { href: '/settings/integrations',   label: 'Integrations',   icon: '🔌' },
  { href: '/settings/actions',        label: 'Action Approvals', icon: '⚡' },
  { href: '/settings/billing',        label: 'Billing',        icon: '💳' },
  { href: '/credits',                 label: 'Credits & Billing', icon: '💰' },
  { href: '/packs',                   label: 'AI Packs',       icon: '📦' },
  { href: '/settings/language',       label: 'Language',       icon: '🌐' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [pendingActions, setPendingActions] = useState(0)

  // Fetch pending action count for the badge
  useEffect(() => {
    async function fetchPending() {
      const res = await apiFetch<{ actions: Array<{ status: string }> }>('/api/v1/actions')
      if (res.success && res.data?.actions) {
        setPendingActions(res.data.actions.filter((a) => a.status === 'PENDING').length)
      }
    }
    fetchPending()
  }, [])

  const nav: NavItem[] = STATIC_NAV.map((item) =>
    item.href === '/settings/actions' && pendingActions > 0
      ? { ...item, badge: pendingActions }
      : item,
  )

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <aside className="w-52 shrink-0 border-r border-zinc-800 p-4">
        <div className="mb-6">
          <Link href="/dashboard" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">← Dashboard</Link>
          <h2 className="text-sm font-semibold text-white mt-3">Settings</h2>
        </div>
        <nav className="space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
