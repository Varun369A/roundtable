'use client'
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function GoogleAnalytics() {
  if (!GA_ID) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  )
}

// Track events from anywhere in the app
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window === 'undefined' || !(window as any).gtag) return
  ;(window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  })
}
