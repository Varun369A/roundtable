'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',           label: 'Dashboard',       icon: '📊', desc: 'KPIs & live tasks' },
      { href: '/admin/analytics', label: 'Analytics',       icon: '📈', desc: 'Cohort & revenue' },
    ],
  },
  {
    label: 'Users & Access',
    items: [
      { href: '/admin/users',     label: 'Users',           icon: '👥', desc: 'Manage accounts' },
      { href: '/admin/beta',      label: 'Beta Invites',    icon: '🎟️', desc: 'Invite codes' },
      { href: '/admin/flags',     label: 'Feature Flags',   icon: '🚩', desc: 'Toggle features' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/tasks',      label: 'Task Monitor',   icon: '⚡', desc: 'All running tasks' },
      { href: '/admin/connectors', label: 'AI Health',      icon: '🤖', desc: 'Model status' },
      { href: '/admin/sabha',      label: 'Arivarangam AI', icon: '🧠', desc: 'AI system config' },
    ],
  },
  {
    label: 'Growth & Trust',
    items: [
      { href: '/admin/broadcast',  label: 'Broadcast',      icon: '📢', desc: 'Message all users' },
      { href: '/admin/marketing',  label: 'Marketing',      icon: '📣', desc: 'Waitlist & campaigns' },
      { href: '/admin/feedback',   label: 'Feedback',       icon: '💬', desc: 'User reports' },
      { href: '/admin/nova',       label: 'Nova AI',        icon: '🔮', desc: 'Admin AI assistant' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { href: '/admin/developer',  label: 'Dev Tools',      icon: '🧪', desc: 'Debug & test' },
      { href: '/admin/sandbox',    label: 'Sandbox',        icon: '🏖️', desc: 'Safe test env' },
    ],
  },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    fetch(`${API_URL}/api/v1/admin/analytics/overview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => { if (res.status === 401 || res.status === 403) router.replace('/admin-login') })
      .catch(() => {}) // network errors don't kick out the admin
      .finally(() => setChecking(false))
  }, [router])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Verifying admin access…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
            <span className="ml-1.5 text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">admin</span>
          </Link>
        </div>

        {/* System status indicator */}
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-700">System Operational</p>
            <p className="text-[10px] text-emerald-600">{time}</p>
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-tight">{item.label}</p>
                        {!active && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.desc}</p>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-slate-50">
        {children}
      </div>
    </div>
  )
}
