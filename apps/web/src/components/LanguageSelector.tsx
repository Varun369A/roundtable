'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Language {
  code: string
  name: string
  nativeName: string
}

interface LanguageSelectorProps {
  value: string
  onChange: (code: string) => void
  showAuto?: boolean
  className?: string
}

export function LanguageSelector({ value, onChange, showAuto = true, className = '' }: LanguageSelectorProps) {
  const [languages, setLanguages] = useState<Language[]>([])

  useEffect(() => {
    apiFetch<{ languages: Language[] }>('/api/v1/language/supported')
      .then((res) => {
        if (res.success && res.data) setLanguages(res.data.languages)
      })
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-brand-500 focus:outline-none transition-colors ${className}`}
    >
      {showAuto && (
        <option value="auto">Auto-detect language</option>
      )}
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName} ({lang.name})
        </option>
      ))}
    </select>
  )
}
