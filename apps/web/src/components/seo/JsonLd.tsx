export function SoftwareAppJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Arivarangam",
      "applicationCategory": "DeveloperApplication",
      "applicationSubCategory": "AI Development Platform",
      "operatingSystem": "Web",
      "url": "https://arivarangam.com",
      "description": "Arivarangam is an AI platform for web development, app development, content creation, digital marketing, and business strategy. Multiple AI models — Claude, GPT-4o, Gemini, Perplexity — work together as a team to complete your goals.",
      "featureList": [
        "AI web development assistance",
        "AI mobile app development",
        "AI content and copywriting",
        "AI digital marketing campaigns",
        "AI business strategy",
        "AI data analysis",
        "Multi-AI orchestration",
        "Indian language support (Hindi, Tamil, Telugu)",
        "UPI and Indian payment methods"
      ],
      "screenshot": "https://arivarangam.com/og-image.png",
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
      },
      "creator": {
        "@type": "Organization",
        "name": "Arivarangam",
        "url": "https://arivarangam.com"
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
        {
          "@type": "Question",
          "name": "Can I use Arivarangam for web development?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Arivarangam uses multiple AI specialists — an architect AI plans your code, a researcher AI finds the best approach, and a coder AI writes the implementation. It handles web apps, APIs, landing pages, and full-stack projects." }
        },
        {
          "@type": "Question",
          "name": "Can I use Arivarangam for mobile app development?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Arivarangam handles mobile app development tasks including React Native, Flutter, iOS, and Android. Multiple AI models collaborate to plan, research, and implement your app." }
        },
        {
          "@type": "Question",
          "name": "What can Arivarangam build or create?",
          "acceptedAnswer": { "@type": "Answer", "text": "Arivarangam can help you build web applications, mobile apps, marketing campaigns, business strategies, content and copywriting, data analysis, presentations, and more. It coordinates 10+ specialist AI models to complete complex tasks." }
        },
        {
          "@type": "Question",
          "name": "Is Arivarangam free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Arivarangam has a free tier with credits to get started. No credit card required. Paid plans start from affordable pricing with more tasks and AI access." }
        },
        {
          "@type": "Question",
          "name": "How is Arivarangam different from ChatGPT or Claude?",
          "acceptedAnswer": { "@type": "Answer", "text": "Arivarangam uses multiple AI models simultaneously — Claude for reasoning, GPT-4o for structured tasks, Gemini for research, Perplexity for real-time search. Each model plays a specialist role and the results are synthesized into one complete output." }
        },
        {
          "@type": "Question",
          "name": "Does Arivarangam support Indian languages?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes — Arivarangam supports Hindi, Tamil, Telugu, Bengali, Marathi and other Indian languages. It also accepts UPI, credit/debit cards, net banking, and wallets via Razorpay." }
        },
        {
          "@type": "Question",
          "name": "Can I use my own API keys?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Arivarangam's BYOAI feature lets you connect your own Anthropic, OpenAI, Google, or other API keys. Tasks using your own keys are free." }
        }
      ]
    })}} />
  )
}

export function OrganizationJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Arivarangam",
      "url": "https://arivarangam.com",
      "logo": "https://arivarangam.com/icon-512.png",
      "description": "AI platform for web development, app development, content creation and business strategy. Multiple AI specialists work together on your goals.",
      "sameAs": [
        "https://twitter.com/sabhaai",
        "https://linkedin.com/company/sabhaai"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "support@arivarangam.com",
        "availableLanguage": ["English", "Hindi", "Tamil", "Telugu"]
      }
    })}} />
  )
}
