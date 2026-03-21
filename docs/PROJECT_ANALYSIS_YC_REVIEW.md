# Sabha (Roundtable) — YC Combinator-Style Deep Review

## What It Is

**Sabha** is an AI orchestration platform. The pitch: "Type one goal, watch Claude, GPT-4, Perplexity, Midjourney, ElevenLabs work together live, get the complete deliverable in minutes." It's a multi-AI collaboration engine with a "Roundtable" UX — a 3-round discussion protocol (Initial work → Cross-review → Synthesis) across 16+ AI models.

**Target market:** India-first (INR pricing, Razorpay, Sarvam for Indian languages, UPI credits).

---

## The Good (Why a YC Partner Might Lean In)

### 1. The Core Insight Is Strong
The "AI fragmentation problem" is real. Users today juggle ChatGPT for writing, Midjourney for images, Perplexity for research, ElevenLabs for audio. The cost adds up (~$100+/month separately). Sabha bundles this at ~$20/month (Studio at Rs.1,999). **This is a genuine pain point with a clear value prop.**

### 2. Impressive Technical Depth for a Solo/Small Team
- **46,000+ lines of TypeScript** across a well-structured Turborepo monorepo
- 16 AI connectors with fallback chains and circuit breakers
- 3-round Discussion Engine (INITIAL → REVIEW → SYNTHESIS) — genuinely novel
- Intent parsing → Task decomposition → Multi-AI orchestration pipeline
- SSE streaming, Redis pub/sub for real-time UI
- BYOAI (Bring Your Own API Keys) model on the Builder tier
- Expert marketplace with credit escrow
- Workflow builder, scheduled tasks, code project support
- GDPR/DPDP Act compliance baked in
- Voice input (Whisper), Indian language layer (Sarvam)
- Load testing with k6, Sentry integration, Prometheus metrics

### 3. Smart India-First Pricing
- Free: 5 tasks/month (trial)
- Builder: Rs.799/mo (~$10) — BYOAI
- Studio: Rs.1,999/mo (~$24) — Sabha absorbs API costs
- The "separately costs Rs.8,526/mo" framing is compelling

### 4. Multiple Revenue Streams Designed In
- Subscriptions (primary)
- Credit system (top-up, referral bonuses)
- Expert marketplace (commission on human reviews)
- Vertical packs
- Enterprise tier

---

## The Concerns (Why a YC Partner Might Pass)

### 1. CRITICAL: Unit Economics Are Upside Down
This is the **#1 kill risk**. At Rs.1,999/month (~$24), Sabha promises "unlimited Roundtable tasks" with "Sabha pays API costs."

- A single complex Roundtable task (3 rounds × multiple models) could easily cost $0.50-$2.00+ in API calls
- Claude Opus alone costs ~$15/1M input tokens
- Midjourney, ElevenLabs, Runway each have significant per-call costs
- A power user doing 5 tasks/day = 150 tasks/month = **$75-300 in API costs alone**
- Revenue per user: $24/month

**Sabha is selling a buffet for the price of a snack.** The "unlimited" promise on Studio is a ticking bomb.

### 2. Aggregator Fragility
- Every AI provider can change pricing, rate limit, or cut off API access
- OpenAI, Anthropic, Google are all building their own multi-model features
- If Claude adds "use GPT for research" natively, the moat evaporates

### 3. "16 AIs" Is Marketing, Not a Moat
- Connecting to 16 APIs is engineering work, not a defensible advantage
- Any funded competitor can replicate these integrations in weeks

### 4. Discussion Engine Is Clever But Expensive and Slow
- 3 rounds means 3x the API cost and 3x the latency
- Does cross-review actually improve output quality enough to justify the cost? No data shown.

### 5. Enormous Scope for Current Stage
- 50+ features built, 0 users
- Workflows, scheduled tasks, code projects, expert marketplace, vertical packs, voice, multi-language...
- Feature graveyard risk

### 6. India-Only = Small Initial TAM
- Indian SaaS willingness-to-pay is historically low
- Rs.1,999/month is premium for India
- The users willing to pay $24/month for AI tools are primarily in the US/EU

### 7. No Evidence of Traction
- "Building in stealth. Coming soon."
- Beta code system exists but no indication of active beta users
- Month 1 of 12 roadmap completed

---

## The Verdict

### Score: 6/10 — Interesting but not fundable in current form

| Factor | Assessment |
|--------|-----------|
| Problem | Real (8/10) |
| Solution | Clever but unvalidated (6/10) |
| Unit economics | Broken (3/10) |
| Moat | Weak (3/10) |
| Execution | Impressive code, but over-scoped (5/10) |
| Market timing | Good — AI fragmentation is peaking (7/10) |
| Team | Unknown (solo dev building 46K LOC is impressive but unsustainable) |

---

## Recommendations to Make This Fundable

1. **Fix unit economics.** Drop "unlimited" from Studio. Move to credit-based pricing per Roundtable session. The Builder (BYOAI) model is the healthier business.

2. **Kill 80% of features.** Ship the Roundtable experience and nothing else. Get 100 users obsessed with multi-AI Roundtables first.

3. **Prove the Discussion Engine works.** A/B test: single-model vs. Roundtable output quality. If 3-round collaboration is measurably better, that's the moat.

4. **Geo-based pricing.** Rs.1,999 for India, $49/month for US/EU.

5. **Get 50 paying users before writing another line of code.** The codebase is ahead of PMF.

6. **Consider B2B pivot.** "AI orchestration for enterprises" at $500/seat/month is a much better business than consumer SaaS at $24/month.
