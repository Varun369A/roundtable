import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Arivarangam',
  description: 'How Arivarangam collects, uses, and protects your personal data. Compliant with India\'s PDPB and GDPR principles.',
  alternates: {
    canonical: 'https://arivarangam.com/privacy',
  },
  robots: { index: true, follow: true },
}

const SECTIONS = [
  { id: 'what-we-collect',   title: '1. What We Collect' },
  { id: 'how-we-use',        title: '2. How We Use Data' },
  { id: 'data-sharing',      title: '3. Data Sharing' },
  { id: 'retention',         title: '4. Data Retention' },
  { id: 'your-rights',       title: '5. Your Rights' },
  { id: 'cookies',           title: '6. Cookies' },
  { id: 'security',          title: '7. Security' },
  { id: 'children',          title: '8. Children' },
  { id: 'ai-providers',      title: '9. AI Providers Disclosure' },
  { id: 'contact',           title: '10. Contact' },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          Arivarangam<span className="text-brand-500">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Terms of Service</Link>
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Log in</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Contents</p>
            <nav className="space-y-1">
              {SECTIONS.map(({ id, title }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block text-sm py-1.5 px-3 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  {title}
                </a>
              ))}
            </nav>
            <div className="mt-8 p-4 rounded-xl border border-blue-200 bg-blue-50">
              <p className="text-xs font-semibold text-blue-700 mb-2">Your Rights</p>
              <p className="text-xs text-slate-500 leading-relaxed">You can access, correct, export, or delete your data at any time from your account settings.</p>
              <Link href="/settings/account" className="text-xs text-blue-600 hover:text-blue-500 mt-2 block transition-colors">
                Manage my data →
              </Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-3 text-slate-900">Privacy Policy</h1>
            <p className="text-slate-500">Effective date: <span className="text-slate-700">January 1, 2025</span></p>
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
              <p className="text-slate-700 leading-relaxed text-sm">
                Arivarangam ("Arivarangam", "we", "us", "our") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, share, and protect your information when you use our platform at <span className="text-slate-900">arivarangam.com</span>. This policy is designed to comply with India's <span className="text-slate-900">Digital Personal Data Protection Act, 2023 (DPDPA)</span> and the principles of the EU's General Data Protection Regulation (GDPR).
              </p>
            </div>
          </div>

          <div className="space-y-12">

            <section id="what-we-collect">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">1. What We Collect</h2>
              <p className="text-slate-500 mb-4 leading-relaxed">We collect the following categories of personal and usage data:</p>

              <div className="space-y-4">
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-2">Account Data</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Name, email address, phone number (optional), profile photo (optional), account creation date, and authentication credentials (passwords are hashed using bcrypt; we never store plaintext passwords).</p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-2">Usage Data</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Task content (your prompts and AI outputs), interaction history, feature usage patterns, device information (browser type, OS, screen resolution), IP address, session identifiers, and crash/error logs. We also collect Arivarangam's self-learning data — preferences and instructions you save to your memory profile.</p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-2">Payment Data</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Transaction history, subscription tier, and credit balance. Full payment card details are processed by Razorpay and are never stored on Arivarangam's servers. Arivarangam receives only a tokenised reference and transaction status from Razorpay.</p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-2">Voice Recordings</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">When you use Arivarangam's voice input feature, audio is captured on your device and transmitted to our transcription service (Sarvam AI for Indian languages; OpenAI Whisper for English) for conversion to text. Audio recordings are not stored on Arivarangam's servers after transcription is complete. The resulting transcribed text is treated as task content under the Usage Data category.</p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-2">BYOAI Keys</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">If you use the BYOAI feature, your third-party AI API keys are stored encrypted at rest (AES-256-GCM) and used solely to make API requests on your behalf.</p>
                </div>
              </div>
            </section>

            <section id="how-we-use">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">2. How We Use Data</h2>
              <p className="text-slate-500 mb-4 leading-relaxed">We use your data for the following purposes, each with a corresponding legal basis:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Purpose</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Providing and operating the Arivarangam platform', 'Contractual necessity'],
                      ['Processing payments and managing subscriptions', 'Contractual necessity'],
                      ['Personalising your Arivarangam experience (user memory)', 'Legitimate interest / Consent'],
                      ['Sending transactional emails (receipts, alerts)', 'Contractual necessity'],
                      ['Sending product updates and newsletters', 'Consent (opt-in)'],
                      ['Detecting and preventing fraud and abuse', 'Legitimate interest'],
                      ["Improving Arivarangam's platform and features (aggregated, anonymised)", 'Legitimate interest'],
                      ['Complying with legal obligations', 'Legal obligation'],
                      ['Customer support', 'Contractual necessity / Legitimate interest'],
                    ].map(([purpose, basis]) => (
                      <tr key={purpose}>
                        <td className="py-3 px-4 text-slate-700">{purpose}</td>
                        <td className="py-3 px-4 text-slate-500">{basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="data-sharing">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">3. Data Sharing</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>We do not sell your personal data. We share your data only in the following circumstances:</p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-2">Razorpay (Payment Processing)</h3>
                    <p className="text-sm text-slate-500">Your name, email, and payment details are shared with Razorpay to process transactions. Razorpay is PCI-DSS compliant. See Razorpay's <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-500">Privacy Policy</a>.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                    <h3 className="font-semibold text-amber-800 mb-2">AI Providers — Important Notice</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      When you submit a task, your prompt content is transmitted to one or more of the following AI Providers for processing. <span className="text-slate-800">This is fundamental to how Arivarangam works.</span> Each provider processes your prompts on their own servers and is subject to their own privacy policies.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Anthropic (Claude)', url: 'https://www.anthropic.com/privacy' },
                        { name: 'OpenAI (GPT-4, Whisper)', url: 'https://openai.com/privacy' },
                        { name: 'Google (Gemini)', url: 'https://policies.google.com/privacy' },
                        { name: 'Perplexity AI', url: 'https://www.perplexity.ai/privacy' },
                        { name: 'Midjourney', url: 'https://docs.midjourney.com/docs/privacy-policy' },
                        { name: 'ElevenLabs', url: 'https://elevenlabs.io/privacy' },
                        { name: 'Stability AI', url: 'https://stability.ai/privacy-policy' },
                        { name: 'Sarvam AI', url: 'https://www.sarvam.ai/privacy-policy' },
                      ].map(({ name, url }) => (
                        <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          {name}
                        </a>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Arivarangam's AI Firewall redacts identified PII (Aadhaar, PAN, phone numbers, email addresses) before transmission. However, you should avoid including sensitive personal information in your prompts.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-2">Service Providers</h3>
                    <p className="text-sm text-slate-500">We use infrastructure partners including cloud hosting providers and monitoring services. These providers access data only as necessary to perform services on our behalf and are bound by data processing agreements.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-2">Legal Requirements</h3>
                    <p className="text-sm text-slate-500">We may disclose your data to governmental authorities or law enforcement when required by applicable Indian or international law, court order, or to protect Arivarangam's legal rights.</p>
                  </div>
                </div>
              </div>
            </section>

            <section id="retention">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">4. Data Retention</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-500 font-medium">Data Category</th>
                        <th className="text-left py-3 px-4 text-slate-500 font-medium">Retention Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ['Account data', 'Duration of account + 90 days after deletion'],
                        ['Task content and AI outputs', '12 months, or until you delete them'],
                        ['Payment records', '7 years (tax and audit compliance)'],
                        ['Voice audio (raw)', 'Deleted immediately after transcription'],
                        ['Usage logs and analytics', '24 months (aggregated, anonymised)'],
                        ['Security and fraud logs', '3 years'],
                        ['BYOAI API keys', 'Until revoked, or within 24h of account deletion'],
                      ].map(([category, period]) => (
                        <tr key={category}>
                          <td className="py-3 px-4 text-slate-700">{category}</td>
                          <td className="py-3 px-4 text-slate-500">{period}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-slate-500">
                  When you delete your account, we initiate deletion of your personal data within 30 days, except where retention is required by law or legitimate business interests (such as fraud prevention or resolving disputes).
                </p>
              </div>
            </section>

            <section id="your-rights">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">5. Your Rights</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>Under India's Digital Personal Data Protection Act, 2023 and applicable law, you have the following rights regarding your personal data:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { right: 'Right to Access', desc: 'Request a copy of all personal data we hold about you.' },
                    { right: 'Right to Correction', desc: 'Request correction of inaccurate or incomplete data.' },
                    { right: 'Right to Deletion', desc: 'Request erasure of your personal data (subject to legal exceptions).' },
                    { right: 'Right to Data Export', desc: 'Receive your data in a machine-readable format (data portability).' },
                    { right: 'Right to Grievance Redressal', desc: 'Lodge a complaint with Arivarangam\'s Data Protection Officer.' },
                    { right: 'Right to Withdraw Consent', desc: 'Withdraw consent for optional processing at any time.' },
                  ].map(({ right, desc }) => (
                    <div key={right} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <p className="font-semibold text-slate-900 text-sm mb-1">{right}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  To exercise your rights, visit your <Link href="/settings/account" className="text-brand-600 hover:text-brand-500">Account Settings</Link> or contact our Data Protection Officer at <a href="mailto:admin@arivarangam.com" className="text-brand-600 hover:text-brand-500">admin@arivarangam.com</a>. We will respond to requests within <span className="text-slate-700">30 days</span>.
                </p>
              </div>
            </section>

            <section id="cookies">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">6. Cookies</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>Arivarangam uses cookies and similar tracking technologies to operate and improve our Service. We use:</p>
                <div className="space-y-3">
                  {[
                    { type: 'Essential Cookies', desc: 'Required for authentication, session management, and security. Cannot be disabled.', required: true },
                    { type: 'Preference Cookies', desc: 'Remember your language, theme, and interface preferences.', required: false },
                    { type: 'Analytics Cookies', desc: 'Help us understand how users interact with Arivarangam (aggregated, anonymised). We do not use Google Analytics.', required: false },
                  ].map(({ type, desc, required }) => (
                    <div key={type} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <span className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${required ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {required ? 'Required' : 'Optional'}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{type}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">You can manage optional cookie preferences through your browser settings or through Arivarangam's cookie preferences panel (accessible from the footer).</p>
              </div>
            </section>

            <section id="security">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">7. Security</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>Arivarangam implements industry-standard security measures to protect your data:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { measure: 'Encryption at rest', detail: 'AES-256-GCM encryption for sensitive data including API keys and user memory.' },
                    { measure: 'Encryption in transit', detail: 'All data transmitted over TLS 1.3. HSTS enforced.' },
                    { measure: 'Password hashing', detail: 'bcrypt with cost factor 12. Passwords are never stored in plaintext.' },
                    { measure: 'AI Firewall', detail: 'Automatic PII detection and redaction before data is sent to AI Providers.' },
                    { measure: 'Access controls', detail: 'Role-based access control (RBAC) with principle of least privilege for internal systems.' },
                    { measure: 'Audit logging', detail: 'All access to user data is logged for security monitoring and compliance.' },
                  ].map(({ measure, detail }) => (
                    <div key={measure} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-600 text-xs">✓</span>
                        <p className="font-semibold text-slate-900 text-sm">{measure}</p>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Despite these measures, no system is perfectly secure. In the event of a data breach that is likely to result in high risk to your rights and freedoms, Arivarangam will notify affected users within 72 hours of becoming aware, as required by applicable law. To report a security vulnerability, contact <a href="mailto:admin@arivarangam.com" className="text-brand-600 hover:text-brand-500">admin@arivarangam.com</a>.
                </p>
              </div>
            </section>

            <section id="children">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">8. Children</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                  <p>Arivarangam is intended for users who are <span className="text-slate-900 font-semibold">13 years of age or older</span>. We do not knowingly collect personal data from children under the age of 13.</p>
                </div>
                <p>
                  If you are a parent or guardian and believe that your child under 13 has created a Arivarangam account, please contact us at <a href="mailto:admin@arivarangam.com" className="text-brand-600 hover:text-brand-500">admin@arivarangam.com</a> and we will promptly delete the account and associated data.
                </p>
                <p>
                  Users between 13 and 18 years of age should use Arivarangam only with the consent and supervision of a parent or guardian.
                </p>
              </div>
            </section>

            <section id="ai-providers">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">9. AI Providers Disclosure</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <p className="text-amber-800 font-semibold mb-2">Your prompts are processed by third-party AI providers</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Arivarangam operates as an orchestration layer over multiple AI APIs. When you run a task, your prompt content — after PII filtering — is transmitted to the servers of Anthropic, OpenAI, Google, and/or other AI Providers depending on the models selected. These companies process your data on their own infrastructure in their respective jurisdictions (typically the United States).
                  </p>
                </div>
                <p>
                  By using Arivarangam, you acknowledge and consent to this cross-border transfer of your data to AI Provider servers outside India. Arivarangam takes steps to ensure these providers have adequate data protection measures in place (API agreements, data processing addenda where available).
                </p>
                <p>
                  Arivarangam's AI Firewall automatically detects and redacts the following PII categories before transmission:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Aadhaar numbers', 'PAN card numbers', 'Passport numbers',
                    'Phone numbers', 'Email addresses', 'Bank account numbers',
                    'Credit card numbers', 'Date of birth', 'Physical addresses',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="text-green-600 text-xs">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Arivarangam does not control how AI Providers use data submitted via their APIs. Please review each provider's API data usage policies, as these differ from consumer product policies. Most major AI providers do not use API data to train their models by default.
                </p>
              </div>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold mb-4 text-slate-900">10. Contact & Data Protection Officer</h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>For any privacy-related enquiries, requests, or complaints:</p>
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                  <p><span className="text-slate-500">Data Protection Officer:</span> <a href="mailto:admin@arivarangam.com" className="text-brand-600 hover:text-brand-500">admin@arivarangam.com</a></p>
                  <p><span className="text-slate-500">Manage your data:</span> <Link href="/settings/account" className="text-brand-600 hover:text-brand-500">Settings → Account → Data & Privacy</Link></p>
                  <p><span className="text-slate-500">Response time:</span> <span className="text-slate-700">Within 30 days of receipt</span></p>
                </div>
                <p className="text-sm text-slate-400">
                  If you are dissatisfied with our response, you may lodge a complaint with India's Data Protection Board once it is operational under the Digital Personal Data Protection Act, 2023.
                </p>
              </div>
            </section>

          </div>

          <div className="mt-16 pt-8 border-t border-slate-200 text-sm text-slate-400">
            <p>Last updated: January 1, 2025 · <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link></p>
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white mt-12 py-8 text-center text-slate-400 text-sm">
        <p>Arivarangam · <Link href="/privacy" className="hover:text-slate-600">Privacy Policy</Link> · <Link href="/terms" className="hover:text-slate-600">Terms of Service</Link></p>
      </footer>
    </div>
  )
}
