import type { TemplateAgent, TemplateCategory } from '@sabha/types'

export interface BuiltInTemplate {
  name: string
  description: string
  category: TemplateCategory
  subcategory?: string
  icon: string
  color: string
  agents: TemplateAgent[]
  examplePrompts: string[]
  tags: string[]
}

/**
 * All built-in Sabha Roundtable templates.
 * Seeded into the database on first run.
 *
 * Agent `dependsOnPrevious: true` means this agent waits for the one before it.
 * `dependsOnPrevious: false` means it can run in parallel with independent siblings.
 */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [

  // ──────────────────────────────────────────────────────────────
  // DEVELOPMENT
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Web App Development',
    description: 'Full-stack web app: architecture → research → implementation → review → docs',
    category: 'development',
    subcategory: 'web-app',
    icon: '🌐',
    color: 'indigo',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Tech Researcher',
        category: 'research',
        instruction: 'Research the best tech stack, libraries, and current best practices for this web app. Include security considerations, scalability options, and popular frameworks. Provide concrete recommendations with reasoning.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'System Architect',
        category: 'strategy',
        instruction: 'Based on the research, design the complete system architecture. Define: folder structure, API design (routes, auth, data models), component hierarchy, state management approach, and deployment strategy. Be specific and production-ready.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Lead Developer',
        category: 'code',
        instruction: 'Write the core implementation code based on the architecture. Include: main entry points, key components/routes, database schema, API handlers, and setup instructions. Code must be clean, typed, and production-grade.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Code Reviewer',
        category: 'code',
        instruction: 'Review the implementation for: security vulnerabilities, performance issues, missing error handling, and code quality. Suggest specific improvements and flag any critical issues.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Documentation Writer',
        category: 'presentation',
        instruction: 'Create comprehensive technical documentation: README, API docs, setup guide, and architecture overview. Format for a developer audience.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Build a SaaS expense tracker with team collaboration',
      'Create a real-time multiplayer quiz application',
      'Develop an e-commerce platform with payment integration',
      'Build a project management tool with Kanban boards',
    ],
    tags: ['web', 'fullstack', 'javascript', 'typescript', 'saas'],
  },

  {
    name: 'Mobile App Development',
    description: 'Mobile app: research → architecture → UI design → implementation → store listing',
    category: 'development',
    subcategory: 'mobile-app',
    icon: '📱',
    color: 'blue',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Platform Researcher',
        category: 'research',
        instruction: 'Research: React Native vs Flutter vs native, required libraries, App Store/Play Store guidelines, and similar apps. Provide specific technical recommendations.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Mobile Architect',
        category: 'strategy',
        instruction: 'Design the mobile app architecture: navigation structure, state management, offline support strategy, push notification flow, and API integration pattern. Include platform-specific considerations.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'UI Designer',
        category: 'images',
        instruction: 'Design the key UI screens: onboarding, home dashboard, main feature screens, and settings. Create visually appealing, mobile-first designs following platform guidelines.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Core Developer',
        category: 'code',
        instruction: 'Implement the core app code: navigation setup, main screens, API integration, local storage, and authentication flow. Include platform-specific optimizations.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Store Listing Writer',
        category: 'copywriting',
        instruction: 'Write the App Store and Play Store listing: title, subtitle, description, keywords for ASO, and release notes. Make it compelling and keyword-optimized.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Build a fitness tracking app with workout logging',
      'Create a language learning app for Indian languages',
      'Develop a food delivery app with real-time tracking',
      'Build a meditation and mindfulness app',
    ],
    tags: ['mobile', 'react-native', 'flutter', 'ios', 'android'],
  },

  {
    name: 'Desktop App / Tool',
    description: 'CLI tool or desktop app: requirements → implementation → packaging → docs',
    category: 'development',
    subcategory: 'desktop-tool',
    icon: '🖥️',
    color: 'violet',
    agents: [
      {
        model: 'claude-3-5-sonnet',
        role: 'Requirements Analyst',
        category: 'strategy',
        instruction: 'Analyze and structure the requirements for this tool. Define: core features, CLI/GUI interface design, input/output specification, error cases, and target user workflow.',
        dependsOnPrevious: false,
      },
      {
        model: 'perplexity-sonar',
        role: 'Tech Researcher',
        category: 'research',
        instruction: 'Research: best language/framework for this type of tool, existing solutions to differentiate from, packaging and distribution methods (npm, brew, winget), and cross-platform considerations.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-opus',
        role: 'Developer',
        category: 'code',
        instruction: 'Build the complete tool implementation. Include: core logic, CLI interface with help text, configuration handling, error messages, and basic tests. Make it immediately runnable.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Technical Writer',
        category: 'copywriting',
        instruction: 'Write the complete documentation: README with installation, usage examples, configuration options, troubleshooting guide, and contribution guidelines.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Build a CLI tool to automate AWS S3 deployments',
      'Create a desktop app to batch-resize images',
      'Develop a file organizer tool with smart categorization',
      'Build a database migration CLI with rollback support',
    ],
    tags: ['cli', 'desktop', 'automation', 'tools', 'nodejs'],
  },

  {
    name: 'API / Backend Service',
    description: 'REST or GraphQL API: design → implementation → testing strategy → deployment docs',
    category: 'development',
    subcategory: 'api-backend',
    icon: '⚙️',
    color: 'emerald',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'API Standards Researcher',
        category: 'research',
        instruction: 'Research: REST vs GraphQL for this use case, authentication patterns (JWT, OAuth, API keys), rate limiting approaches, API versioning strategies, and similar public APIs for inspiration.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'API Architect',
        category: 'strategy',
        instruction: 'Design the complete API: endpoint structure, request/response schemas, authentication flow, error codes, pagination strategy, and data models. Create an OpenAPI-style specification.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Backend Engineer',
        category: 'code',
        instruction: 'Implement the API with: all endpoint handlers, middleware (auth, validation, rate limiting), database queries, error handling, and logging. Use modern practices and TypeScript.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Security & QA Reviewer',
        category: 'code',
        instruction: 'Review the API implementation for: SQL injection, XSS, CSRF, authentication bypass, insecure direct object references, and missing input validation. Provide specific fixes.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'API Documentation Writer',
        category: 'presentation',
        instruction: 'Create developer documentation: API reference with examples, authentication guide, quickstart tutorial, and Postman collection structure.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Build a payments API with Razorpay integration',
      'Create a notifications API with multi-channel delivery',
      'Develop a file upload and processing API',
      'Build a real-time chat API with WebSocket support',
    ],
    tags: ['api', 'rest', 'graphql', 'backend', 'nodejs'],
  },

  // ──────────────────────────────────────────────────────────────
  // DESIGN
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Brand Identity Design',
    description: 'Complete brand: research → strategy → visual identity → style guide → copy',
    category: 'design',
    subcategory: 'brand-identity',
    icon: '✨',
    color: 'pink',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Market Researcher',
        category: 'research',
        instruction: 'Research the industry, target audience, competitors, and current design trends. Identify white space in brand positioning and visual opportunities.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Brand Strategist',
        category: 'strategy',
        instruction: 'Define the brand: personality, values, positioning statement, tone of voice, and key differentiators. Create a mood board concept description and brand archetype.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'Visual Designer',
        category: 'images',
        instruction: 'Create the visual identity concepts: logo concepts, color palette visualization, typography pairings, and brand pattern/texture concepts. Generate multiple style directions.',
        dependsOnPrevious: true,
      },
      {
        model: 'dalle-3',
        role: 'Asset Creator',
        category: 'images',
        instruction: 'Generate brand application mockups: business cards, letterhead, social media profiles, and product packaging concepts showing the brand in real-world use.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Style Guide Author',
        category: 'presentation',
        instruction: 'Create the complete brand style guide: logo usage rules, color specifications (HEX, RGB, CMYK, Pantone), typography hierarchy, spacing system, imagery guidelines, and do/don\'ts.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Create brand identity for a sustainable fashion startup',
      'Design brand system for a fintech app targeting Gen Z',
      'Build brand identity for a cloud kitchen in Bangalore',
      'Create visual identity for an EdTech platform',
    ],
    tags: ['branding', 'logo', 'visual-identity', 'design-system'],
  },

  {
    name: 'UI/UX Product Design',
    description: 'Product design: user research → UX flow → UI screens → prototype spec → handoff',
    category: 'design',
    subcategory: 'ui-ux',
    icon: '🎨',
    color: 'purple',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'UX Researcher',
        category: 'research',
        instruction: 'Research: target users, their pain points, competitor UX patterns, and accessibility requirements. Find relevant UX case studies and industry standards.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'UX Architect',
        category: 'strategy',
        instruction: 'Design the user experience: user personas, user journey maps, information architecture, navigation patterns, and interaction flows. Include accessibility considerations.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'UI Designer',
        category: 'images',
        instruction: 'Create high-fidelity UI screen designs for the key user flows. Design a clean, modern interface with attention to typography, spacing, color, and visual hierarchy.',
        dependsOnPrevious: true,
      },
      {
        model: 'dalle-3',
        role: 'Illustration Creator',
        category: 'images',
        instruction: 'Create custom illustrations, icons, and empty-state graphics for the product. Maintain consistency with the established visual direction.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Developer Handoff Writer',
        category: 'copywriting',
        instruction: 'Create a developer handoff spec: component specifications, interaction behaviors, animation timings, responsive breakpoints, and accessibility requirements.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Design a dashboard for an analytics SaaS product',
      'Create UX for a mobile banking app',
      'Design an onboarding flow for a B2B tool',
      'Build UI for a real-time collaboration platform',
    ],
    tags: ['ui', 'ux', 'product-design', 'figma', 'user-research'],
  },

  // ──────────────────────────────────────────────────────────────
  // LEARNING
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Course Creation',
    description: 'Full online course: topic research → curriculum → content → audio lessons → slides',
    category: 'learning',
    subcategory: 'course',
    icon: '🎓',
    color: 'amber',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Subject Matter Researcher',
        category: 'research',
        instruction: 'Research: the topic depth, existing courses to differentiate from, learner prerequisites, key subtopics, industry standards, and what professionals say about learning this subject.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Curriculum Designer',
        category: 'strategy',
        instruction: 'Design the complete curriculum: learning outcomes, module structure, lesson sequence, exercises, assessments, and prerequisite knowledge map. Follow instructional design principles.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Content Writer',
        category: 'copywriting',
        instruction: 'Write the course content: lesson scripts, explanations, examples, analogies, and practice exercises for each module. Make it engaging and easy to understand.',
        dependsOnPrevious: true,
      },
      {
        model: 'elevenlabs',
        role: 'Voice Narrator',
        category: 'audio',
        instruction: 'Convert the lesson content to professional narration audio. Use a clear, engaging teaching voice appropriate for online learning.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Slide Designer',
        category: 'presentation',
        instruction: 'Create the course slide deck: one slide per key concept, visual aids, diagrams, summary slides, and quiz slides. Design for screen learning with clear visuals.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Create a Python programming course for beginners',
      'Build a digital marketing course for small businesses',
      'Design a financial literacy course in Hindi',
      'Create a UX design fundamentals course',
    ],
    tags: ['education', 'course', 'elearning', 'curriculum', 'teaching'],
  },

  {
    name: 'Study Plan & Notes',
    description: 'Exam prep: topic breakdown → study plan → detailed notes → practice questions',
    category: 'learning',
    subcategory: 'study-plan',
    icon: '📚',
    color: 'teal',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Syllabus Researcher',
        category: 'research',
        instruction: 'Research the exam syllabus, common question patterns, high-weight topics, recommended resources, and previous year papers if available. Find what toppers say about preparation.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Study Planner',
        category: 'strategy',
        instruction: 'Create a structured study plan with daily/weekly schedule, topic prioritization, revision cycles, and milestone checkpoints. Account for the time available.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Note Maker',
        category: 'copywriting',
        instruction: 'Create comprehensive study notes for the high-priority topics: clear explanations, memory tricks, key formulas/facts, and visual concept maps.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Question Bank Creator',
        category: 'general',
        instruction: 'Generate a practice question bank: 20 MCQs, 10 short answers, and 5 long-form questions. Include detailed answer explanations for each.',
        dependsOnPrevious: true,
      },
      {
        model: 'sarvam-1',
        role: 'Regional Language Translator',
        category: 'translation',
        instruction: 'Translate the study notes and key concepts to the user\'s regional language (Hindi/Tamil/Telugu/etc.) for easier understanding and retention.',
        dependsOnPrevious: true,
        optional: true,
      },
    ],
    examplePrompts: [
      'Prepare for UPSC Civil Services Exam in 6 months',
      'Study plan for JEE Advanced in 3 months',
      'Notes for NEET Biology in Hindi',
      'CA Foundation exam preparation strategy',
    ],
    tags: ['exam', 'upsc', 'jee', 'neet', 'study', 'notes'],
  },

  // ──────────────────────────────────────────────────────────────
  // MARKETING
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Product Launch Campaign',
    description: 'Full launch: market research → strategy → copy → visuals → press release → social',
    category: 'marketing',
    subcategory: 'product-launch',
    icon: '🚀',
    color: 'orange',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Market Intelligence',
        category: 'research',
        instruction: 'Research: target market size, competitor launches, industry news, influencers in this space, and winning launch strategies. Find timing opportunities and media outlets.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Launch Strategist',
        category: 'strategy',
        instruction: 'Build the complete launch strategy: positioning, go-to-market approach, channel mix, launch timeline (pre/launch/post), PR plan, and success KPIs.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Copywriter',
        category: 'copywriting',
        instruction: 'Write all launch copy: tagline, value proposition, hero copy, email sequence (pre-launch, launch day, follow-up), landing page copy, and ad copy variations.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'Visual Creator',
        category: 'images',
        instruction: 'Create launch visuals: hero banner, social media graphics, email header, ad creatives. Make them bold, shareable, and brand-consistent.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'PR & Content Writer',
        category: 'copywriting',
        instruction: 'Write: press release (AP style), product hunt launch post, LinkedIn announcement, Twitter thread, and influencer pitch templates.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Pitch Deck Creator',
        category: 'presentation',
        instruction: 'Build the investor/partner launch presentation: problem, solution, market size, traction, product demo flow, and ask.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Launch a B2B SaaS HR platform',
      'Launch a consumer app in the Indian health market',
      'Product launch for a D2C beauty brand',
      'Launch a developer tool on Product Hunt',
    ],
    tags: ['launch', 'gtm', 'pr', 'campaign', 'product-marketing'],
  },

  {
    name: 'Content Marketing Engine',
    description: 'Content strategy + creation: SEO research → calendar → articles → social → newsletter',
    category: 'marketing',
    subcategory: 'content-marketing',
    icon: '✍️',
    color: 'cyan',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'SEO & Trend Researcher',
        category: 'research',
        instruction: 'Research: high-volume, low-competition keywords, trending topics in the industry, competitor content gaps, and question patterns from target audience. Provide a keyword cluster map.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Content Strategist',
        category: 'strategy',
        instruction: 'Create a 3-month content calendar: topic clusters, publishing frequency, content types (pillar posts, supporting articles, social series), and distribution channels.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Lead Article Writer',
        category: 'copywriting',
        instruction: 'Write the top 3 pillar articles from the content calendar. Each should be 1500+ words, SEO-optimized, with proper headings, internal linking opportunities, and a strong CTA.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Social Media Manager',
        category: 'copywriting',
        instruction: 'Repurpose the articles into social content: 5 LinkedIn posts, 10 Twitter/X threads, 5 Instagram captions with hashtag sets, and 3 short-form video scripts.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'Visual Content Creator',
        category: 'images',
        instruction: 'Create featured images for each article, social media graphics for key posts, and infographic concepts for the most data-heavy content.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Content strategy for a fintech startup blog',
      'Create content marketing for a SaaS HR tool',
      'Build content engine for an edtech platform',
      'Content calendar for a D2C food brand',
    ],
    tags: ['content', 'seo', 'blog', 'social-media', 'newsletter'],
  },

  // ──────────────────────────────────────────────────────────────
  // BUSINESS
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Business Plan',
    description: 'Complete business plan: market research → strategy → financials → pitch deck',
    category: 'business',
    subcategory: 'business-plan',
    icon: '💼',
    color: 'slate',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Market Analyst',
        category: 'research',
        instruction: 'Research: market size (TAM/SAM/SOM), industry trends, key competitors with their funding/revenue, target customer segments, and regulatory landscape.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Business Strategist',
        category: 'strategy',
        instruction: 'Write the complete business plan sections: executive summary, problem/solution, value proposition, business model (revenue streams), competitive advantage, go-to-market strategy, and operational plan.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4-turbo',
        role: 'Financial Modeler',
        category: 'data_analysis',
        instruction: 'Create detailed financial projections: 3-year P&L forecast, cash flow model, unit economics (CAC, LTV, payback period), break-even analysis, and funding requirements.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Pitch Deck Designer',
        category: 'presentation',
        instruction: 'Build the investor pitch deck (12-15 slides): problem, solution, market, product, traction, business model, team, financials, ask. Make it compelling and visually clear.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'Presentation Visuals',
        category: 'images',
        instruction: 'Create impactful visuals for the pitch: market size charts, product screenshots/mockups, competitive positioning map, and team culture imagery.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Business plan for a quick-commerce startup in India',
      'Plan for a B2B SaaS company targeting SMEs',
      'Business plan for an EV charging network',
      'Plan for an agritech platform for farmers',
    ],
    tags: ['startup', 'business-plan', 'pitch-deck', 'funding', 'strategy'],
  },

  {
    name: 'Competitive Intelligence',
    description: 'Deep competitor analysis: research → SWOT → positioning map → strategy recommendations',
    category: 'business',
    subcategory: 'competitive-analysis',
    icon: '🔍',
    color: 'red',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Competitive Intelligence Analyst',
        category: 'research',
        instruction: 'Research all major competitors: their products, pricing, funding, team size, customer reviews, marketing strategy, recent news, and market share. Be comprehensive.',
        dependsOnPrevious: false,
      },
      {
        model: 'cohere',
        role: 'Data Synthesizer',
        category: 'data_analysis',
        instruction: 'Synthesize the competitive data into structured analysis: feature comparison matrix, pricing comparison table, and positioning analysis.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Strategic Advisor',
        category: 'strategy',
        instruction: 'Write strategic recommendations: identified market gaps, differentiation opportunities, threats to defend against, and a prioritized action plan based on competitive findings.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Report Designer',
        category: 'presentation',
        instruction: 'Create a competitive intelligence report/presentation with visual competitor comparison charts, positioning maps, and strategic recommendations.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Competitive analysis for entering the Indian CRM market',
      'Analyze competitors in the online tutoring space',
      'Research the food delivery market for a new entrant',
      'Competitive landscape for a fintech lending startup',
    ],
    tags: ['competitive-analysis', 'market-research', 'strategy', 'intelligence'],
  },

  // ──────────────────────────────────────────────────────────────
  // CONTENT
  // ──────────────────────────────────────────────────────────────

  {
    name: 'YouTube Video Production',
    description: 'Complete video: research → script → thumbnail → narration → description/tags',
    category: 'content',
    subcategory: 'youtube',
    icon: '🎬',
    color: 'rose',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Trend & SEO Researcher',
        category: 'research',
        instruction: 'Research: YouTube search volume for this topic, trending angles, top-performing videos to study, recommended video length, and keywords to optimize for.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Script Writer',
        category: 'copywriting',
        instruction: 'Write the full video script: hook (first 30 seconds), main content with clear structure, examples/stories, and CTA. Write for spoken word. Include timestamps for editing.',
        dependsOnPrevious: true,
      },
      {
        model: 'elevenlabs',
        role: 'Voice Narrator',
        category: 'audio',
        instruction: 'Record the narration audio for this video script in a clear, energetic voice appropriate for YouTube content.',
        dependsOnPrevious: true,
      },
      {
        model: 'midjourney-v6',
        role: 'Thumbnail Designer',
        category: 'images',
        instruction: 'Create 3 thumbnail concepts: high-contrast, emotion-driven, with bold text overlays. Design for click-through — make them impossible to ignore.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'SEO Metadata Writer',
        category: 'copywriting',
        instruction: 'Write the YouTube metadata: title (with keyword), description (first 150 chars must hook), full description with timestamps, tags (20+), and pinned comment text.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'YouTube video explaining how AI is changing jobs',
      'Tech review video for a new smartphone',
      'Finance tutorial: how to invest in index funds',
      'Travel vlog script for a Rajasthan road trip',
    ],
    tags: ['youtube', 'video', 'content-creation', 'script', 'thumbnail'],
  },

  {
    name: 'Podcast Episode',
    description: 'Podcast: topic research → outline → host script → guest questions → show notes',
    category: 'content',
    subcategory: 'podcast',
    icon: '🎙️',
    color: 'fuchsia',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Topic Researcher',
        category: 'research',
        instruction: 'Research the episode topic deeply: recent developments, contrarian views, interesting statistics, potential guest angles, and questions the audience is asking.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Episode Producer',
        category: 'strategy',
        instruction: 'Create the episode structure: compelling title/hook, segment breakdown with timing, key talking points, transition phrases, and B-roll/music cue notes.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Script & Questions Writer',
        category: 'copywriting',
        instruction: 'Write the host script, 20 interview questions (if applicable) from surface to deep, ad-read scripts, intro/outro scripts, and listener engagement prompts.',
        dependsOnPrevious: true,
      },
      {
        model: 'elevenlabs',
        role: 'Intro Narrator',
        category: 'audio',
        instruction: 'Record a professional podcast intro teaser with the episode title, host name, and key listener benefit. Make it warm and engaging.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Show Notes Writer',
        category: 'copywriting',
        instruction: 'Write comprehensive show notes: episode summary, key takeaways, all resources/links mentioned, guest bio, and episode transcript outline.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Podcast episode on startup funding in India 2025',
      'Deep dive into AI replacing white-collar jobs',
      'Interview prep for a founder on their journey',
      'Episode about sustainable investing',
    ],
    tags: ['podcast', 'audio', 'interview', 'show-notes', 'script'],
  },

  // ──────────────────────────────────────────────────────────────
  // RESEARCH
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Market Research Report',
    description: 'Full market research: data gathering → analysis → insights → visual report',
    category: 'research',
    subcategory: 'market-research',
    icon: '📊',
    color: 'green',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Primary Researcher',
        category: 'research',
        instruction: 'Conduct comprehensive market research: market size and growth rate, key segments, customer demographics, buying behavior, pricing analysis, and major trends. Cite sources.',
        dependsOnPrevious: false,
      },
      {
        model: 'gemini-pro',
        role: 'Secondary Researcher',
        category: 'research',
        instruction: 'Research additional dimensions: regulatory environment, technology disruptions, international comparisons, expert opinions, and future projections.',
        dependsOnPrevious: false,
      },
      {
        model: 'gpt-4-turbo',
        role: 'Data Analyst',
        category: 'data_analysis',
        instruction: 'Analyze all research data: identify patterns, calculate market metrics, create data tables, and draw statistically sound conclusions. Flag any conflicting data.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Insights Writer',
        category: 'copywriting',
        instruction: 'Write the research report: executive summary, methodology, key findings, implications for business strategy, and actionable recommendations.',
        dependsOnPrevious: true,
      },
      {
        model: 'gamma',
        role: 'Report Designer',
        category: 'presentation',
        instruction: 'Create the visual research report/presentation with charts, infographics, key stat callouts, and an executive summary slide.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Market research report on India\'s EV market 2025',
      'Research the D2C beauty market in Southeast Asia',
      'Analyze the Indian EdTech landscape post-COVID',
      'Market size analysis for cloud kitchen segment',
    ],
    tags: ['market-research', 'report', 'analysis', 'data', 'insights'],
  },

  {
    name: 'Technical Research Paper',
    description: 'Academic/technical paper: literature review → analysis → writing → review → polish',
    category: 'research',
    subcategory: 'technical-paper',
    icon: '📄',
    color: 'zinc',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Literature Reviewer',
        category: 'research',
        instruction: 'Conduct a literature review: find and summarize 15+ relevant papers, identify research gaps, map the current state of knowledge, and note methodologies used.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Paper Outliner',
        category: 'strategy',
        instruction: 'Structure the paper: abstract, introduction (problem statement, contributions), related work, methodology, experimental design, and conclusion outline.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Lead Author',
        category: 'copywriting',
        instruction: 'Write all paper sections in academic style: abstract, introduction, methodology, results, discussion, and conclusion. Maintain formal tone and proper citation placeholders.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Critical Reviewer',
        category: 'general',
        instruction: 'Review the paper for: logical consistency, unsupported claims, missing citations, clarity issues, and adherence to academic writing standards. Suggest specific improvements.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Write a paper on LLM hallucination mitigation techniques',
      'Research paper on federated learning for privacy',
      'Technical analysis of RAG vs fine-tuning for enterprise AI',
      'Survey paper on Indian language NLP models',
    ],
    tags: ['academic', 'research', 'paper', 'technical-writing', 'literature-review'],
  },

  // ──────────────────────────────────────────────────────────────
  // PERSONAL
  // ──────────────────────────────────────────────────────────────

  {
    name: 'Career Growth Plan',
    description: 'Personal career: skills gap analysis → learning plan → resume → LinkedIn → outreach',
    category: 'personal',
    subcategory: 'career',
    icon: '🌱',
    color: 'lime',
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Job Market Researcher',
        category: 'research',
        instruction: 'Research the target role/industry: in-demand skills, salary ranges, top companies hiring, career paths, and what differentiates top candidates.',
        dependsOnPrevious: false,
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Career Advisor',
        category: 'strategy',
        instruction: 'Create a personalized career plan: skills gap analysis, 90-day action plan, learning resources prioritized by impact, networking strategy, and career milestones.',
        dependsOnPrevious: true,
      },
      {
        model: 'gpt-4o',
        role: 'Resume & LinkedIn Writer',
        category: 'copywriting',
        instruction: 'Write an ATS-optimized resume and LinkedIn profile that highlights achievements with metrics, uses keywords from top job descriptions, and tells a compelling career story.',
        dependsOnPrevious: true,
      },
      {
        model: 'claude-3-opus',
        role: 'Outreach Specialist',
        category: 'copywriting',
        instruction: 'Write personalized outreach templates: cold email to hiring managers, LinkedIn connection notes, referral request messages, and follow-up sequences.',
        dependsOnPrevious: true,
      },
    ],
    examplePrompts: [
      'Transition from software engineer to product manager',
      'Break into AI/ML field from a non-technical background',
      'Career plan to become a senior data scientist',
      'Strategy to land a remote job at a US tech company from India',
    ],
    tags: ['career', 'resume', 'linkedin', 'job-search', 'personal-development'],
  },
]
