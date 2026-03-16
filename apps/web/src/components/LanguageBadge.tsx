'use client'

const LANG_NAMES: Record<string, string> = {
  en: 'EN', hi: 'हि', ta: 'த', te: 'తె', kn: 'ಕ',
  ml: 'മ', mr: 'म', bn: 'ব', gu: 'ગ', pa: 'ਪ', or: 'ଓ',
}

interface LanguageBadgeProps {
  languageCode: string
  className?: string
}

export function LanguageBadge({ languageCode, className = '' }: LanguageBadgeProps) {
  if (!languageCode || languageCode === 'en' || languageCode === 'auto') return null

  const label = LANG_NAMES[languageCode] || languageCode.toUpperCase()

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ${className}`}
      title={`Language: ${languageCode}`}
    >
      {label}
    </span>
  )
}
