'use client'

import { useEffect, useRef, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Sarvam AI supported languages + English
const SARVAM_LANGUAGES: Array<{ code: string; label: string; flag: string }> = [
  { code: 'en',    label: 'English',    flag: '🇬🇧' },
  { code: 'hi',    label: 'Hindi',      flag: '🇮🇳' },
  { code: 'bn',    label: 'Bengali',    flag: '🇧🇩' },
  { code: 'gu',    label: 'Gujarati',   flag: '🇮🇳' },
  { code: 'kn',    label: 'Kannada',    flag: '🇮🇳' },
  { code: 'ml',    label: 'Malayalam',  flag: '🇮🇳' },
  { code: 'mr',    label: 'Marathi',    flag: '🇮🇳' },
  { code: 'od',    label: 'Odia',       flag: '🇮🇳' },
  { code: 'pa',    label: 'Punjabi',    flag: '🇮🇳' },
  { code: 'ta',    label: 'Tamil',      flag: '🇮🇳' },
  { code: 'te',    label: 'Telugu',     flag: '🇮🇳' },
  { code: 'ur',    label: 'Urdu',       flag: '🇵🇰' },
]

type RecordingState = 'idle' | 'requesting_permission' | 'recording' | 'transcribing' | 'done' | 'error'

interface VoiceInputButtonProps {
  onTranscription: (text: string, language: string) => void
  language?: string
  disabled?: boolean
  className?: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const MAX_RECORDING_SECONDS = 120

export function VoiceInputButton({
  onTranscription,
  language: initialLanguage = 'en',
  disabled = false,
  className = '',
}: VoiceInputButtonProps) {
  const [state, setState]           = useState<RecordingState>('idle')
  const [duration, setDuration]     = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const [lang, setLang]             = useState(initialLanguage)
  const [showLangPicker, setShowLangPicker] = useState(false)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks   = useRef<Blob[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval>>()
  const autoStopRef   = useRef<ReturnType<typeof setTimeout>>()
  const langPickerRef = useRef<HTMLDivElement>(null)

  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).mediaDevices !== 'undefined' &&
    typeof MediaRecorder !== 'undefined'

  // Close lang picker on outside click
  useEffect(() => {
    if (!showLangPicker) return
    function handler(e: MouseEvent) {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLangPicker])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(autoStopRef.current)
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop()
      }
    }
  }, [])

  async function startRecording() {
    if (!isSupported) return
    setError(null)
    setState('requesting_permission')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
      setState('error')
      return
    }

    audioChunks.current = []
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorder.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.current.push(e.data)
    }

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      clearInterval(timerRef.current)
      clearTimeout(autoStopRef.current)

      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
      await transcribe(blob)
    }

    recorder.start(250) // collect chunks every 250ms
    setState('recording')
    setDuration(0)

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)

    // Auto-stop at max duration
    autoStopRef.current = setTimeout(() => {
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.stop()
      }
    }, MAX_RECORDING_SECONDS * 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    clearTimeout(autoStopRef.current)
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop()
    }
    setState('transcribing')
  }

  async function transcribe(blob: Blob) {
    setState('transcribing')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')
      formData.append('language', lang)

      const res = await fetch(`${API_URL}/api/v1/voice/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Transcription failed')
      }

      const text: string = json.data?.text || json.text || ''
      setState('done')
      onTranscription(text, lang)

      // Reset to idle after brief success flash
      setTimeout(() => setState('idle'), 2000)
    } catch (err: any) {
      setError(err?.message || 'Transcription failed. Please try again.')
      setState('error')
    }
  }

  function handleMainClick() {
    if (disabled || !isSupported) return
    if (state === 'idle' || state === 'error') {
      startRecording()
    } else if (state === 'recording') {
      stopRecording()
    }
  }

  const currentLang = SARVAM_LANGUAGES.find((l) => l.code === lang) || SARVAM_LANGUAGES[0]
  const isNonEnglish = lang !== 'en'

  if (!isSupported) {
    return (
      <div className={`relative group inline-flex ${className}`}>
        <button
          disabled
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-60"
          aria-label="Voice input not supported"
        >
          <MicIcon />
        </button>
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none">
          <div className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
            Voice input not supported in this browser
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {/* Language picker */}
      {state === 'idle' && (
        <div className="relative" ref={langPickerRef}>
          <button
            type="button"
            onClick={() => setShowLangPicker((v) => !v)}
            disabled={disabled}
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Change input language"
            aria-label={`Change input language, currently ${currentLang.label}`}
            aria-expanded={showLangPicker}
            aria-haspopup="listbox"
          >
            <span>{currentLang.flag}</span>
            {isNonEnglish && <span className="uppercase">{lang}</span>}
          </button>

          {showLangPicker && (
            <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden w-44">
              <div className="max-h-52 overflow-y-auto">
                {SARVAM_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => { setLang(l.code); setShowLangPicker(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors hover:bg-zinc-800 ${
                      l.code === lang ? 'text-white bg-zinc-800 font-semibold' : 'text-zinc-300'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {l.code === lang && (
                      <svg className="w-3 h-3 ml-auto text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main mic / stop button */}
      <div className="relative">
        {/* Pulse ring while recording */}
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-xl bg-red-500/30 animate-ping" />
        )}

        <button
          type="button"
          onClick={handleMainClick}
          disabled={disabled || state === 'requesting_permission' || state === 'transcribing' || state === 'done'}
          aria-label={state === 'recording' ? 'Stop recording' : 'Start voice input'}
          className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 ${
            state === 'recording'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : state === 'transcribing'
              ? 'bg-blue-600/30 text-blue-400 cursor-wait'
              : state === 'done'
              ? 'bg-green-600/30 text-green-400'
              : state === 'error'
              ? 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
              : state === 'requesting_permission'
              ? 'bg-zinc-800 text-zinc-500 cursor-wait'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
          } disabled:cursor-not-allowed`}
        >
          {state === 'recording' && <StopIcon />}
          {state === 'transcribing' && (
            <span className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
          )}
          {state === 'done' && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {(state === 'idle' || state === 'error' || state === 'requesting_permission') && <MicIcon />}
        </button>
      </div>

      {/* Duration while recording */}
      {state === 'recording' && (
        <span className="text-xs font-mono tabular-nums text-red-400 select-none min-w-[2.5rem]">
          {formatDuration(duration)}
        </span>
      )}

      {/* Transcribing label */}
      {state === 'transcribing' && (
        <span className="text-xs text-blue-400 select-none">Transcribing…</span>
      )}

      {/* Error tooltip */}
      {state === 'error' && error && (
        <div className="absolute bottom-full mb-2 left-0 z-50 max-w-xs">
          <div className="bg-zinc-800 border border-red-500/30 text-xs text-red-400 px-2.5 py-1.5 rounded-lg shadow-xl leading-snug">
            {error}
          </div>
        </div>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}
