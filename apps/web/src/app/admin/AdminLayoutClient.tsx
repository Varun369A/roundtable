'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const NAV = [
  { href: '/admin',            label: 'Overview',    icon: '📊' },
  { href: '/admin/users',      label: 'Users',       icon: '👥' },
  { href: '/admin/tasks',      label: 'Tasks',       icon: '⚡' },
  { href: '/admin/analytics',  label: 'Analytics',   icon: '📈' },
  { href: '/admin/connectors', label: 'AI Health',   icon: '🤖' },
  { href: '/admin/costs',      label: 'Costs',       icon: '💰' },
  { href: '/admin/sabha',      label: 'Sabha AI',    icon: '🧠' },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Verify admin access
    apiFetch('/api/v1/admin/analytics/overview')
      .then((res) => {
        if (!res.success) router.replace('/dashboard')
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setChecking(false))
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Verifying admin access…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-zinc-800">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Sabha<span className="text-red-500">.</span>
            <span className="text-xs text-red-500 ml-1 font-normal">admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <Link href="/dashboard" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Back to Sabha
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
