'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { LanguageSelector } from '@/components/LanguageSelector'

const DEMO_TRANSLATIONS: Record<string, string> = {
  en: 'Create a marketing campaign for my chai brand targeting college students',
  hi: 'मेरे चाय ब्रांड के लिए कॉलेज छात्रों को लक्षित करते हुए एक मार्केटिंग अभियान बनाएं',
  ta: 'கல்லூரி மாணவர்களை இலக்காகக் கொண்ட என் சாய் பிராண்டுக்கான மார்க்கெட்டிங் பிரச்சாரத்தை உருவாக்கு',
  te: 'కళాశాల విద్యార్థులను లక్ష్యంగా చేసుకుని నా చాయ్ బ్రాండ్ కోసం మార్కెటింగ్ ప్రచారాన్ని సృష్టించు',
  kn: 'ಕಾಲೇಜು ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಗುರಿಯಾಗಿಸಿಕೊಂಡು ನನ್ನ ಚಹಾ ಬ್ರಾಂಡ್‌ಗೆ ಮಾರ್ಕೆಟಿಂಗ್ ಅಭಿಯಾನ ರಚಿಸಿ',
  ml: 'കോളേജ് വിദ്യാർഥികളെ ലക്ഷ്യമാക്കി എന്റെ ചായ ബ്രാൻഡിനായി ഒരു മാർക്കറ്റിംഗ് കാമ്പയിൻ സൃഷ്ടിക്കുക',
  mr: 'महाविद्यालयीन विद्यार्थ्यांना लक्ष्य करून माझ्या चाय ब्रँडसाठी मार्केटिंग मोहीम तयार करा',
  bn: 'কলেজ ছাত্রছাত্রীদের লক্ষ্য করে আমার চা ব্র্যান্ডের জন্য একটি মার্কেটিং ক্যাম্পেইন তৈরি করুন',
  gu: 'કૉલેજ વિદ્યાર્થીઓને લક્ષ્ય બનાવીને મારા ચા બ્રાન્ડ માટે માર્કેટિંગ ઝુંબેશ બનાવો',
  pa: 'ਕਾਲਜ ਵਿਦਿਆਰਥੀਆਂ ਨੂੰ ਨਿਸ਼ਾਨਾ ਬਣਾਉਂਦੇ ਹੋਏ ਮੇਰੇ ਚਾਹ ਬ੍ਰਾਂਡ ਲਈ ਇੱਕ ਮਾਰਕੀਟਿੰਗ ਮੁਹਿੰਮ ਬਣਾਓ',
}

export default function LanguageSettingsPage() {
  const router = useRouter()
  const [currentLang, setCurrentLang] = useState('auto')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [previewLang, setPreviewLang] = useState('hi')

  useEffect(() => {
    apiFetch<{ language: string }>('/api/v1/language/preference')
      .then((res) => {
        if (!res.success) { router.push('/login'); return }
        setCurrentLang(res.data?.language || 'auto')
      })
  }, [router])

  async function save() {
    setSaving(true)
    const res = await apiFetch('/api/v1/language/preference', {
      method: 'PUT',
      body: JSON.stringify({ language: currentLang }),
    })
    if (res.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="font-medium text-sm">Language Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
          <h1 className="text-xl font-bold mb-2">
            Arivarangam speaks your language
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Type your goals in Hindi, Tamil, Telugu, or any of 10 Indian languages.
            Arivarangam's AI team works in English internally and delivers everything back to you
            in your chosen language. Powered by Sarvam AI.
          </p>
        </div>

        {/* Language preference */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold mb-1">Preferred language</h2>
          <p className="text-zinc-500 text-sm mb-4">
            Arivarangam will detect your language automatically, or you can set a fixed preference.
          </p>

          <LanguageSelector
            value={currentLang}
            onChange={setCurrentLang}
            showAuto={true}
            className="w-full mb-4"
          />

          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save preference'}
          </button>
        </div>

        {/* Live language demo */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold mb-4">See it in action</h2>
          <p className="text-zinc-500 text-sm mb-4">
            This is how Arivarangam understands the same goal in different languages:
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(DEMO_TRANSLATIONS).map(([code]) => (
              <button
                key={code}
                onClick={() => setPreviewLang(code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  previewLang === code
                    ? 'bg-brand-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
            <p className="text-sm text-zinc-400 mb-1 font-mono">User input ({previewLang}):</p>
            <p className="text-zinc-100 leading-relaxed">
              {DEMO_TRANSLATIONS[previewLang] || DEMO_TRANSLATIONS['en']}
            </p>
            {previewLang !== 'en' && (
              <>
                <div className="my-3 border-t border-zinc-700" />
                <p className="text-sm text-zinc-400 mb-1 font-mono">Arivarangam understands (en):</p>
                <p className="text-zinc-400 leading-relaxed italic">
                  {DEMO_TRANSLATIONS['en']}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Supported languages grid */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold mb-4">Supported languages</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { code: 'hi', name: 'Hindi',     native: 'हिन्दी',   speakers: '600M+' },
              { code: 'bn', name: 'Bengali',   native: 'বাংলা',    speakers: '230M+' },
              { code: 'te', name: 'Telugu',    native: 'తెలుగు',   speakers: '82M+'  },
              { code: 'mr', name: 'Marathi',   native: 'मराठी',    speakers: '83M+'  },
              { code: 'ta', name: 'Tamil',     native: 'தமிழ்',    speakers: '78M+'  },
              { code: 'gu', name: 'Gujarati',  native: 'ગુજરાતી',  speakers: '56M+'  },
              { code: 'kn', name: 'Kannada',   native: 'ಕನ್ನಡ',    speakers: '44M+'  },
              { code: 'ml', name: 'Malayalam', native: 'മലയാളം',   speakers: '38M+'  },
              { code: 'pa', name: 'Punjabi',   native: 'ਪੰਜਾਬੀ',   speakers: '33M+'  },
              { code: 'or', name: 'Odia',      native: 'ଓଡ଼ିଆ',    speakers: '38M+'  },
            ].map((lang) => (
              <div
                key={lang.code}
                className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
              >
                <div className="text-lg mb-0.5">{lang.native}</div>
                <div className="text-sm font-medium text-zinc-300">{lang.name}</div>
                <div className="text-xs text-zinc-600">{lang.speakers} speakers</div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
