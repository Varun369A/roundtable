export function SoftwareAppJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Sabha",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": "https://sabhaai.com",
      "description": "Multi-AI orchestration platform. Coordinate Claude, GPT-4, Gemini and 10+ AI models.",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "INR",
        "lowPrice": "0",
        "highPrice": "2499",
        "offerCount": "4"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "127"
      }
    })}} />
  )
}

export function PricingFaqJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Is Sabha free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! Sabha has a free tier with 5 tasks per month and access to 2 AI models." }},
        { "@type": "Question", "name": "Can I use my own API keys?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — Sabha's BYOAI feature lets you connect your own Anthropic, OpenAI, or other API keys. Tasks using your own keys are free." }},
        { "@type": "Question", "name": "Does Sabha support Indian languages?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — Sabha supports Hindi, Tamil, Telugu, Bengali, Marathi and 6 other Indian languages via Sarvam AI voice input." }},
        { "@type": "Question", "name": "What payment methods are accepted?", "acceptedAnswer": { "@type": "Answer", "text": "We accept all major Indian payment methods via Razorpay: UPI, credit/debit cards, net banking, and wallets." }}
      ]
    })}} />
  )
}

export function OrganizationJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Sabha AI",
      "url": "https://sabhaai.com",
      "logo": "https://sabhaai.com/icon-512.png",
      "sameAs": ["https://twitter.com/sabhaai", "https://linkedin.com/company/sabhaai"],
      "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", "email": "support@sabhaai.com" }
    })}} />
  )
}
