import type { Metadata } from 'next'
import Link from 'next/link'
import TermsTOC from './TermsTOC'

export const metadata: Metadata = {
  title: 'Terms of Service — Sabha',
  description: 'Sabha AI Terms of Service. Effective January 1, 2025.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://sabhaai.com/terms' },
}

const SECTIONS = [
  { id: 'acceptance',       title: '1. Acceptance of Terms' },
  { id: 'service',          title: '2. Description of Service' },
  { id: 'accounts',         title: '3. User Accounts' },
  { id: 'acceptable-use',   title: '4. Acceptable Use Policy' },
  { id: 'ai-content',       title: '5. AI-Generated Content Disclaimer' },
  { id: 'payment',          title: '6. Payment & Billing' },
  { id: 'byoai',            title: '7. Bring Your Own AI (BYOAI)' },
  { id: 'data-privacy',     title: '8. Data & Privacy' },
  { id: 'ip',               title: '9. Intellectual Property' },
  { id: 'liability',        title: '10. Limitation of Liability' },
  { id: 'indemnification',  title: '11. Indemnification' },
  { id: 'termination',      title: '12. Termination' },
  { id: 'governing-law',    title: '13. Governing Law' },
  { id: 'contact',          title: '14. Contact' },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="border-b border-zinc-800/50 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Sabha<span className="text-brand-500">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-sm text-zinc-400 hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Log in</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar TOC — client component for active-section highlighting */}
        <TermsTOC sections={SECTIONS} />

        {/* Content */}
        <main className="flex-1 max-w-3xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-3">Terms of Service</h1>
            <p className="text-zinc-400">Effective date: <span className="text-zinc-300">January 1, 2025</span></p>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Please read these Terms of Service (&ldquo;Terms&rdquo;, &ldquo;Agreement&rdquo;) carefully before using Sabha AI (&ldquo;Sabha&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By accessing or using our platform at <span className="text-zinc-300">sabhaai.com</span>, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </div>

          <div className="space-y-12">

            <section id="acceptance">
              <h2 className="text-2xl font-bold mb-4 text-white">1. Acceptance of Terms</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  By creating an account or using Sabha in any way, you represent that you are at least 13 years of age, have the legal capacity to enter into a binding contract, and agree to comply with and be bound by these Terms.
                </p>
                <p>
                  If you are accessing Sabha on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms, in which case &ldquo;you&rdquo; refers to that organisation.
                </p>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify you of material changes via email or a prominent notice on our platform. Your continued use of Sabha after changes become effective constitutes your acceptance of the revised Terms.
                </p>
              </div>
            </section>

            <section id="service">
              <h2 className="text-2xl font-bold mb-4 text-white">2. Description of Service</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  Sabha is an AI coordination platform that enables users to submit tasks and goals to a curated ensemble of artificial intelligence models — including but not limited to Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google), Perplexity, Midjourney, ElevenLabs, Sarvam AI, and others (collectively, &ldquo;AI Providers&rdquo;) — and receive synthesised outputs through Sabha&rsquo;s proprietary Discussion Engine.
                </p>
                <p>
                  Sabha&rsquo;s platform includes, without limitation: the Discussion Engine (multi-round AI peer review), voice input via Sarvam AI, user memory, scheduled tasks, workflow automation, multiplayer roundtable sessions, the BYOAI (Bring Your Own AI) feature, vertical AI packs, expert review marketplace, agent execution capabilities, and the AI Firewall.
                </p>
                <p>
                  Sabha reserves the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice. We are not liable to you or any third party for any such modification, suspension, or discontinuation.
                </p>
              </div>
            </section>

            <section id="accounts">
              <h2 className="text-2xl font-bold mb-4 text-white">3. User Accounts</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  You must register for an account to use Sabha. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate.
                </p>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us at <a href="mailto:security@sabhaai.com" className="text-brand-400 hover:text-brand-300">security@sabhaai.com</a> if you become aware of any unauthorised use of your account.
                </p>
                <p>
                  You may not share your account with others, create accounts for the purpose of abusing the Service, or use automated methods to create accounts. Each account is for a single natural person or legal entity.
                </p>
                <p>
                  Sabha may require verification of your identity or contact information at any time. Failure to comply with a verification request may result in account suspension.
                </p>
              </div>
            </section>

            <section id="acceptable-use">
              <h2 className="text-2xl font-bold mb-4 text-white">4. Acceptable Use Policy</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>You agree not to use Sabha to:</p>
                <ul className="space-y-2 list-none pl-0">
                  {[
                    'Generate, distribute, or promote content that is illegal, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable under applicable law.',
                    'Create deepfakes, non-consensual intimate imagery, or any content designed to deceive or defraud individuals.',
                    'Generate content that infringes on the intellectual property rights of any third party.',
                    'Facilitate or promote violence, terrorism, extremism, human trafficking, or exploitation of minors.',
                    'Produce medical diagnoses, legal advice, or financial investment advice intended to replace professional consultation without appropriate disclaimers.',
                    'Reverse-engineer, decompile, or attempt to extract Sabha\'s source code, algorithms, or proprietary models.',
                    'Circumvent, disable, or interfere with any security feature or access control of Sabha.',
                    'Scrape, crawl, or use automated tools to extract data from Sabha without express written permission.',
                    'Use Sabha in any manner that could overload, damage, or impair the infrastructure of Sabha or its AI Providers.',
                    'Attempt to manipulate, "jailbreak," or elicit harmful outputs from AI models via prompt injection or other adversarial techniques.',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-red-500 mt-1 shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Sabha reserves the right, but has no obligation, to monitor content submitted through the platform. Violations of this policy may result in immediate account termination and, where required by law, reporting to relevant authorities.
                </p>
              </div>
            </section>

            <section id="ai-content">
              <h2 className="text-2xl font-bold mb-4 text-white">5. AI-Generated Content Disclaimer</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <p className="text-amber-300 font-semibold mb-2">Important Notice</p>
                  <p>All outputs generated by Sabha&rsquo;s platform are produced by artificial intelligence systems and are provided for informational and productivity purposes only. They do not constitute professional legal, medical, financial, psychological, or any other regulated professional advice.</p>
                </div>
                <ul className="space-y-2 list-disc list-inside text-zinc-400">
                  <li><span className="text-zinc-300">Legal content:</span> Sabha&rsquo;s outputs are not a substitute for advice from a qualified advocate, solicitor, or legal professional licensed in your jurisdiction.</li>
                  <li><span className="text-zinc-300">Medical content:</span> Sabha&rsquo;s outputs are not a substitute for advice, diagnosis, or treatment from a qualified medical practitioner. Always seek the advice of your physician.</li>
                  <li><span className="text-zinc-300">Financial content:</span> Sabha&rsquo;s outputs are not investment advice and do not constitute a recommendation to buy, sell, or hold any security or financial instrument.</li>
                </ul>
                <p>
                  AI models may produce outputs that are factually incorrect, outdated, biased, or inappropriate. Sabha does not warrant the accuracy, completeness, reliability, or fitness for any particular purpose of any AI-generated output. You are solely responsible for evaluating and verifying all AI-generated content before acting upon it.
                </p>
                <p>
                  Sabha&rsquo;s Discussion Engine and peer review process improve output quality but do not eliminate the possibility of errors. The presence of a &ldquo;quality score&rdquo; or &ldquo;verified&rdquo; badge on an output indicates a relative confidence level as assessed by automated processes, not a guarantee of factual accuracy.
                </p>
              </div>
            </section>

            <section id="payment">
              <h2 className="text-2xl font-bold mb-4 text-white">6. Payment &amp; Billing</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  Sabha offers subscription plans and a credit-based economy. All prices are denominated in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST) unless explicitly stated otherwise.
                </p>
                <p>
                  <span className="text-white font-medium">Payment processing:</span> All payments are processed by Razorpay Payment Solutions Private Limited (&ldquo;Razorpay&rdquo;), a third-party payment gateway. By making a payment, you also agree to Razorpay&rsquo;s terms of service. Sabha does not store your full card details on its servers.
                </p>
                <p>
                  <span className="text-white font-medium">Subscriptions:</span> Subscription plans renew automatically on the same date each calendar month. You authorise Sabha to charge your payment method on a recurring basis. You may cancel your subscription at any time from your billing settings; cancellation takes effect at the end of the current billing period and you retain access until that date.
                </p>
                <p>
                  <span className="text-white font-medium">Credits:</span> Credits are a non-monetary unit of value used to meter certain Sabha features. Credits purchased do not expire and are non-transferable between accounts unless Sabha expressly states otherwise.
                </p>
                <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-900">
                  <p className="text-white font-semibold mb-2">Refund Policy</p>
                  <p className="text-zinc-400">
                    Subscription payments are eligible for a full refund within <span className="text-white">7 (seven) days</span> of the initial charge, provided you have used fewer than 10 tasks under the plan during that period. No refunds will be issued after 7 days or if the usage threshold has been exceeded. Credit purchases are non-refundable. Refund requests must be submitted to <a href="mailto:billing@sabhaai.com" className="text-brand-400 hover:text-brand-300">billing@sabhaai.com</a>.
                  </p>
                </div>
                <p>
                  Sabha reserves the right to modify pricing with 30 days&rsquo; notice. Price changes will not affect subscriptions until your next renewal date following the notice period.
                </p>
              </div>
            </section>

            <section id="byoai">
              <h2 className="text-2xl font-bold mb-4 text-white">7. Bring Your Own AI (BYOAI)</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  Sabha allows you to connect your own API keys from third-party AI Providers (&ldquo;BYOAI Keys&rdquo;) to use within the Sabha platform. When you use BYOAI Keys:
                </p>
                <ul className="space-y-2 list-disc list-inside text-zinc-400">
                  <li>Your API keys are encrypted at rest using AES-256-GCM encryption and are only decrypted at the time of use to make API calls on your behalf.</li>
                  <li>You remain solely responsible for complying with the terms of service of the respective AI Provider associated with each BYOAI Key.</li>
                  <li>You are solely responsible for all costs incurred on your third-party AI Provider accounts as a result of Sabha&rsquo;s use of your BYOAI Keys.</li>
                  <li>Sabha is not responsible for downtime, rate limits, errors, or policy changes by third-party AI Providers.</li>
                  <li>Sabha does not use your BYOAI Keys for any purpose other than executing tasks you explicitly initiate.</li>
                </ul>
                <p>
                  You may revoke BYOAI Keys at any time from your AI Connections settings. Upon revocation, Sabha will delete the encrypted key from its systems within 24 hours.
                </p>
              </div>
            </section>

            <section id="data-privacy">
              <h2 className="text-2xl font-bold mb-4 text-white">8. Data &amp; Privacy</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  Your privacy is important to us. Our collection and use of personal data is governed by our <Link href="/privacy" className="text-brand-400 hover:text-brand-300">Privacy Policy</Link>, which is incorporated into these Terms by reference.
                </p>
                <p>
                  By using Sabha, you acknowledge that your prompts and task content will be transmitted to one or more third-party AI Provider APIs for processing. While Sabha&rsquo;s AI Firewall automatically redacts identified personally identifiable information (PII) before transmission, you should exercise care in the content you submit and avoid including sensitive personal information where possible.
                </p>
                <p>
                  You retain ownership of all content you submit to Sabha. By submitting content, you grant Sabha a limited, non-exclusive, royalty-free licence to process, transmit, and store that content solely for the purpose of providing the Service to you. Sabha does not use your task content to train its own AI models without your explicit, opt-in consent.
                </p>
              </div>
            </section>

            <section id="ip">
              <h2 className="text-2xl font-bold mb-4 text-white">9. Intellectual Property</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  <span className="text-white font-medium">Sabha&rsquo;s IP:</span> The Sabha platform, including its software, Discussion Engine, AI Firewall, user interface, branding, and all related intellectual property, is owned by Sabha AI and its licensors. These Terms do not grant you any right to use Sabha&rsquo;s trademarks, logos, or brand features without prior written consent.
                </p>
                <p>
                  <span className="text-white font-medium">Your content:</span> You own the prompts you input and, subject to the terms of the applicable AI Providers, the outputs generated in response to those prompts. You are responsible for ensuring you have the right to use any content you submit to Sabha.
                </p>
                <p>
                  <span className="text-white font-medium">AI-generated outputs:</span> The ownership and copyright status of AI-generated content is an evolving area of law. Sabha makes no representation regarding the copyrightability of AI outputs. You assume all risk associated with the use, publication, or commercialisation of AI-generated content.
                </p>
                <p>
                  <span className="text-white font-medium">Feedback:</span> If you provide Sabha with any suggestions, ideas, or feedback about the Service, you grant Sabha a perpetual, irrevocable, royalty-free licence to use such feedback for any purpose without compensation to you.
                </p>
              </div>
            </section>

            <section id="liability">
              <h2 className="text-2xl font-bold mb-4 text-white">10. Limitation of Liability</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-900">
                  <p className="text-sm uppercase text-zinc-500 font-semibold mb-3">Important Legal Notice</p>
                  <p>
                    TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SABHA AI AND ITS DIRECTORS, EMPLOYEES, CONTRACTORS, AGENTS, AFFILIATES, AND LICENSORS (&ldquo;SABHA PARTIES&rdquo;) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF THE SERVICE, EVEN IF SABHA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                  </p>
                  <p className="mt-3">
                    THE TOTAL LIABILITY OF THE SABHA PARTIES FOR ANY CLAIM ARISING UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNT YOU PAID TO SABHA IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM; OR (B) INR 1,000 (ONE THOUSAND RUPEES).
                  </p>
                </div>
                <p>
                  These limitations apply to the fullest extent permitted by law. Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability for certain damages; in such jurisdictions, Sabha&rsquo;s liability shall be limited to the maximum extent permitted by law.
                </p>
                <p>
                  Sabha provides the Service on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
                </p>
              </div>
            </section>

            <section id="indemnification">
              <h2 className="text-2xl font-bold mb-4 text-white">11. Indemnification</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  You agree to indemnify, defend, and hold harmless Sabha AI and the Sabha Parties from and against any claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or in any way related to:
                </p>
                <ul className="space-y-2 list-disc list-inside text-zinc-400">
                  <li>Your use of or inability to use the Service;</li>
                  <li>Your violation of these Terms;</li>
                  <li>Your violation of any rights of a third party, including intellectual property rights, privacy rights, or applicable laws;</li>
                  <li>Content you submit to the Service, including any claim that such content is harmful, offensive, or infringing.</li>
                </ul>
                <p>
                  Sabha reserves the right, at its own cost, to assume the exclusive defence and control of any matter subject to indemnification by you, in which case you agree to cooperate with Sabha&rsquo;s defence of such claim.
                </p>
              </div>
            </section>

            <section id="termination">
              <h2 className="text-2xl font-bold mb-4 text-white">12. Termination</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  <span className="text-white font-medium">By you:</span> You may terminate your account at any time by contacting us at <a href="mailto:support@sabhaai.com" className="text-brand-400 hover:text-brand-300">support@sabhaai.com</a> or through your account settings. Upon termination, your right to use the Service ceases immediately. Unused subscription time is not refunded, except as required by applicable law.
                </p>
                <p>
                  <span className="text-white font-medium">By Sabha:</span> Sabha may suspend or terminate your account immediately, without notice or liability, if we have reasonable grounds to believe you have violated these Terms, engaged in fraudulent activity, or if required to do so by law or court order.
                </p>
                <p>
                  <span className="text-white font-medium">Effect of termination:</span> Upon termination, all licences granted to you under these Terms immediately cease. Sabha may delete your data in accordance with its data retention policy as described in the Privacy Policy. Sections that by their nature should survive termination (including Sections 5, 9, 10, 11, 13) shall survive.
                </p>
              </div>
            </section>

            <section id="governing-law">
              <h2 className="text-2xl font-bold mb-4 text-white">13. Governing Law</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>
                  These Terms and any disputes arising out of or in connection with them shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
                </p>
                <p>
                  Any legal action or proceeding arising out of or relating to these Terms or your use of Sabha shall be brought exclusively in the courts of competent jurisdiction located in <span className="text-white font-medium">Rajasthan, India</span>. You irrevocably consent to the personal jurisdiction and venue of such courts.
                </p>
                <p>
                  Before initiating any formal legal proceedings, you agree to attempt to resolve any dispute informally by contacting Sabha at <a href="mailto:legal@sabhaai.com" className="text-brand-400 hover:text-brand-300">legal@sabhaai.com</a>. Sabha will attempt to resolve the dispute informally within 30 days.
                </p>
                <p>
                  These Terms constitute the entire agreement between you and Sabha regarding your use of the Service, and supersede all prior agreements, whether written or oral, on the same subject matter.
                </p>
              </div>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold mb-4 text-white">14. Contact</h2>
              <div className="space-y-4 text-zinc-300 leading-relaxed">
                <p>If you have any questions about these Terms, please contact us:</p>
                <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 space-y-2">
                  <p><span className="text-zinc-400">Legal enquiries:</span> <a href="mailto:legal@sabhaai.com" className="text-brand-400 hover:text-brand-300">legal@sabhaai.com</a></p>
                  <p><span className="text-zinc-400">Billing disputes:</span> <a href="mailto:billing@sabhaai.com" className="text-brand-400 hover:text-brand-300">billing@sabhaai.com</a></p>
                  <p><span className="text-zinc-400">Security issues:</span> <a href="mailto:security@sabhaai.com" className="text-brand-400 hover:text-brand-300">security@sabhaai.com</a></p>
                  <p><span className="text-zinc-400">General support:</span> <a href="mailto:support@sabhaai.com" className="text-brand-400 hover:text-brand-300">support@sabhaai.com</a></p>
                </div>
              </div>
            </section>

          </div>

          <div className="mt-16 pt-8 border-t border-zinc-800 text-sm text-zinc-600">
            <p>Last updated: January 1, 2025 · <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link></p>
          </div>
        </main>
      </div>

      <footer className="border-t border-zinc-800 mt-12 py-8 text-center text-zinc-600 text-sm">
        <p>Sabha AI · <Link href="/privacy" className="hover:text-zinc-500">Privacy Policy</Link> · <Link href="/terms" className="hover:text-zinc-500">Terms of Service</Link></p>
      </footer>
    </div>
  )
}
