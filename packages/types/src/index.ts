// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserTier = 'FREE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE'
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
  | 'PENDING'       // created, not yet routed
  | 'ROUTING'       // router is building the plan
  | 'IN_PROGRESS'   // AIs are working
  | 'COMPLETED'     // all subtasks done
  | 'FAILED'        // something went wrong
  | 'CANCELLED'     // user cancelled

export type TaskVisibility = 'private' | 'workspace'

export type SubtaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'

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

export type PlanId = 'free' | 'starter' | 'pro' | 'power' | 'enterprise'

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
    tasksPerMonth: 5,
    roundtableTasksPerMonth: 2,
    concurrentTasks: 1,
    teamMembers: 1,
    aiModelsAccess: ['claude-3-5-sonnet', 'gpt-4o'],
    features: ['2 AIs', '5 tasks/month', 'Personal workspace']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceInr: 499,
    tasksPerMonth: 100,
    roundtableTasksPerMonth: 100,
    concurrentTasks: 5,
    teamMembers: 1,
    aiModelsAccess: ['claude-3-5-sonnet', 'gpt-4o', 'perplexity-sonar', 'dalle-3', 'elevenlabs'],
    features: ['5 AIs', '100 roundtable tasks', 'All templates', 'Priority support']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceInr: 1299,
    tasksPerMonth: -1,
    roundtableTasksPerMonth: 500,
    concurrentTasks: 50,
    teamMembers: 1,
    aiModelsAccess: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'sarvam-1', 'gamma'],
    features: ['All AIs', 'Unlimited single tasks', '500 roundtable tasks', 'Custom templates', 'API access']
  },
  power: {
    id: 'power',
    name: 'Power',
    priceInr: 2499,
    tasksPerMonth: -1,
    roundtableTasksPerMonth: -1,
    concurrentTasks: 200,
    teamMembers: 10,
    aiModelsAccess: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'runway-gen3', 'sarvam-1', 'gamma'],
    features: ['Everything in Pro', 'Unlimited roundtable', 'Team workspace (10 members)', 'Priority routing', 'API access']
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceInr: -1,
    tasksPerMonth: -1,
    roundtableTasksPerMonth: -1,
    concurrentTasks: -1,
    teamMembers: -1,
    aiModelsAccess: ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4o', 'gpt-4-turbo', 'gemini-pro', 'perplexity-sonar', 'midjourney-v6', 'dalle-3', 'stability-xl', 'elevenlabs', 'runway-gen3', 'sarvam-1', 'gamma'],
    features: ['Custom contract', 'Unlimited teams', 'SSO/SAML', 'Audit logs', 'SLA', 'On-prem option', 'Dedicated account manager']
  }
}
