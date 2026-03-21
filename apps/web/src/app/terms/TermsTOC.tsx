'use client'

import { useEffect, useRef, useState } from 'react'

interface Section {
  id: string
  title: string
}

interface TermsTOCProps {
  sections: Section[]
}

export default function TermsTOC({ sections }: TermsTOCProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      }
    }
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-20% 0% -70% 0%',
      threshold: 0,
    })
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observerRef.current!.observe(el)
    })
    return () => observerRef.current?.disconnect()
  }, [sections])

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-8">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Contents</p>
        <nav aria-label="Terms of Service table of contents">
          <ul className="space-y-1">
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={activeSection === id ? 'location' : undefined}
                  className={`block text-sm py-1.5 px-3 rounded-lg transition-colors ${
                    activeSection === id
                      ? 'text-white bg-zinc-800 font-medium'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
