// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserTier = 'FREE' | 'BUILDER' | 'STUDIO' | 'ENTERPRISE'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export interface User {
  id: string
  email: string
  name: string
  tier: UserTier
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface JWTPayload {
  sub: string       // user id
  email: string
  tier: UserTier
  iat: number
  exp: number
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
export type WorkspaceType = 'PERSONAL' | 'TEAM' | 'ENTERPRISE'

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  avatarUrl?: string
  type: WorkspaceType
  ownerId: string
  settings: WorkspaceSettings
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceSettings {
  allowMemberInvite: boolean       // can MEMBER role invite others?
  defaultTaskVisibility: 'private' | 'workspace' // default for new tasks
  requireApprovalForPublish: boolean
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  invitedBy?: string
  acceptedAt?: Date
  createdAt: Date
  user?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    tier: UserTier
  }
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  token: string
  expiresAt: Date
  invitedById: string
  acceptedAt?: Date
  createdAt: Date
}

// ─── Roundtable Templates ────────────────────────────────────────────────────

export type TemplateCategory =
  | 'development'
  | 'design'
  | 'learning'
  | 'marketing'
  | 'business'
  | 'content'
  | 'research'
  | 'personal'

export interface TemplateAgent {
  model: AIModel
  role: string              // "Architect", "Code Reviewer", "Researcher"
  instruction: string       // specific instruction for this agent in the template
  category: TaskCategory
  dependsOnPrevious: boolean // simple sequential dependency
  optional?: boolean        // skip if model unavailable?
}

export interface RoundtableTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  subcategory?: string      // e.g. "web-app", "mobile-app" under "development"
  icon: string              // emoji
  color: string             // tailwind color class for UI
  agents: TemplateAgent[]
  examplePrompts: string[]
  tags: string[]
  useCount: number
  isBuiltIn: boolean
  createdBy?: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'PENDING'                 // created, not yet routed
  | 'WAITING_CLARIFICATION'   // paused — awaiting user answers to pre-task questions
  | 'ROUTING'                 // router is building the plan
  | 'IN_PROGRESS'             // AIs are working
  | 'COMPLETED'               // all subtasks done
  | 'FAILED'                  // something went wrong
  | 'CANCELLED'               // user cancelled

export type TaskVisibility = 'private' | 'workspace'

export type SubtaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'

export type SubtaskRole = 'INITIAL' | 'REVIEW' | 'SYNTHESIS'

export type AIModel =
  | 'claude-3-5-sonnet'
  | 'claude-3-opus'
  | 'gpt-4o'
  | 'gpt-4-turbo'
  | 'gemini-pro'
  | 'perplexity-sonar'
  | 'midjourney-v6'
  | 'dalle-3'
  | 'stability-xl'
  | 'elevenlabs'
  | 'runway-gen3'
  | 'sarvam-1'
  | 'gamma'
  | 'sabha-ai'
  | 'groq'
  | 'cohere'
  | 'whisper'

export type TaskCategory =
  | 'research'
  | 'copywriting'
  | 'strategy'
  | 'images'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'code'
  | 'translation'
  | 'data_analysis'
  | 'general'

export interface Task {
  id: string
  userId: string
  workspaceId?: string
  templateId?: string
  title: string
  originalGoal: string
  status: TaskStatus
  visibility: TaskVisibility
  subtasks: Subtask[]
  contextObject: ContextObject
  totalCostUsd: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface Subtask {
  id: string
  taskId: string
  title: string
  category: TaskCategory
  assignedModel: AIModel
  status: SubtaskStatus
  dependsOn: string[]   // subtask IDs this depends on
  role: SubtaskRole
  roundNumber: number
  reviewsSubtaskId?: string
  input: string
  output?: SubtaskOutput
  costUsd?: number
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

export interface SubtaskOutput {
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'json'
  content?: string        // for text outputs
  fileUrl?: string        // for media outputs (S3/R2 URL)
  metadata?: Record<string, unknown>
}

// ─── Context Object (travels with every AI call) ──────────────────────────

export interface ContextObject {
  taskId: string
  userId: string
  originalGoal: string
  templateId?: string
  userProfile: {
    industry?: string
    preferredTone?: string
    language: string
  }
  completedSubtasks: CompletedSubtaskSummary[]
  activeConstraints: string[]
}

export interface CompletedSubtaskSummary {
  id: string
  title: string
  executor: AIModel
  outputSummary: string
  completedAt: Date
}

// ─── Intent Parsing ─────────────────────────────────────────────────────────

export interface ParsedIntent {
  goal: string
  categories: TaskCategory[]
  subject: string
  audience?: string
  deliverables: string[]
  language: string
  urgency: 'low' | 'normal' | 'high'
  constraints: string[]
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'builder' | 'studio' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  priceInr: number
  tasksPerMonth: number
  roundtableTasksPerMonth: number
  concurrentTasks: number
  teamMembers: number       // -1 = unlimited; 1 = solo only
  aiModelsAccess: AIModel[]
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    tasksPerMonth: 3,  // 3 free tasks/month using Sabha's own API keys
    roundtableTasksPerMonth: 3,
    concurrentTasks: 1,
    teamMembers: 1,
    aiModelsAccess: ['claude-3-5-sonnet', 'gpt-4o', 'perplexity-sonar'],
    features: ['3 tasks/month', 'Sabha covers API costs', 'All 9 specialist AIs', 'Upgrade to connect own keys']
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    priceInr: 799,  // founding members: ₹499 locked for life
    tasksPerMonth: -1,  // unlimited — user pays their own API providers
    roundtableTasksPerMonth: -1,
    concurrentTasks: 5,
    teamMembers: 1,
    aiModelsAccess: ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'dalle-3', 'stability-xl', 'elevenlabs', 'sarvam-1'],
    features: ['Unlimited tasks', 'Your own API keys', 'All 9 specialist AIs', 'GitHub push', 'Download ZIP', 'Claude Sonnet synthesis']
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    priceInr: 1999,  // founding members: ₹999 locked for life
    tasksPerMonth: -1,
    roundtableTasksPerMonth: -1,
    concurrentTasks: 20,
    teamMembers: 5,
    aiModelsAccess: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'runway-gen3', 'sarvam-1'],
    features: ['Everything in Builder', 'Claude Opus synthesis', 'Team workspace (5 members)', 'Priority routing', 'Midjourney + Runway']
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceInr: 4999,
    tasksPerMonth: -1,
    roundtableTasksPerMonth: -1,
    concurrentTasks: -1,
    teamMembers: -1,
    aiModelsAccess: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'runway-gen3', 'sarvam-1'],
    features: ['Everything in Studio', 'Unlimited teams', 'SSO/SAML', 'Audit logs', 'SLA', 'On-prem option', 'Dedicated account manager']
  }
}

// ─── Phase 3: Output Quality Verification ────────────────────────────────────

export type VerificationStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'PARTIAL' | 'FAILED'

export interface VerificationIssue {
  type: 'factual' | 'completeness' | 'citation' | 'coherence' | 'hallucination'
  severity: 'low' | 'medium' | 'high'
  description: string
  suggestion?: string
}

export interface VerificationCitation {
  text: string       // the claim being cited
  source: string     // source name
  url?: string
  confidence: number // 0-1
}

export interface SubtaskVerification {
  id: string
  subtaskId: string
  status: VerificationStatus
  confidenceScore: number    // 0-1 overall quality
  factualScore: number
  completenessScore: number
  citationsFound: number
  issues: VerificationIssue[]
  citations: VerificationCitation[]
  verifiedAt?: Date
  verifiedBy?: string
}

// ─── Phase 3: Agent Execution ────────────────────────────────────────────────

export type ActionStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'

export type ActionType =
  | 'GITHUB_PUSH'
  | 'GITHUB_PR'
  | 'GITHUB_ISSUE'
  | 'GMAIL_SEND'
  | 'GMAIL_DRAFT'
  | 'NOTION_PAGE'
  | 'NOTION_DB_ROW'
  | 'WEBHOOK'
  | 'SLACK_MESSAGE'

export interface ExecutionAction {
  id: string
  subtaskId: string
  taskId: string
  userId: string
  type: ActionType
  status: ActionStatus
  integrationId?: string
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  requiresApproval: boolean
  approvedAt?: Date
  rejectedAt?: Date
  rejectedReason?: string
  executedAt?: Date
  expiresAt?: Date
  errorMessage?: string
  createdAt: Date
}

// ─── Phase 3: User Integrations ──────────────────────────────────────────────

export type IntegrationProvider =
  | 'GITHUB'
  | 'GMAIL'
  | 'NOTION'
  | 'SLACK'
  | 'JIRA'
  | 'LINEAR'
  | 'WEBHOOK'

export interface UserIntegration {
  id: string
  userId: string
  provider: IntegrationProvider
  displayName: string
  isActive: boolean
  scopes: string[]
  metadata: Record<string, unknown>
  connectedAt: Date
  lastUsedAt?: Date
  tokenExpiresAt?: Date
}

// ─── Phase 3: Voice Transcription ────────────────────────────────────────────

export interface VoiceTranscription {
  id: string
  userId: string
  taskId?: string
  provider: 'whisper' | 'sarvam'
  language: string
  durationSecs: number
  originalText: string
  processedText: string
  confidence: number
  audioFileUrl?: string
  createdAt: Date
}
