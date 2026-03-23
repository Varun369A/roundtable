'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  id: string
  stepNumber: number
  name: string
  goalTemplate: string
  modelOverride?: string
  outputMappings: Array<{ key: string; description: string }>
  dependsOn?: string[]
}

interface Workflow {
  id: string
  name: string
  description: string
  triggerType: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  steps: WorkflowStep[]
  cronExpression?: string
  webhookSecret?: string
}

interface WorkflowRun {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  startedAt: string
  completedAt?: string
  stepRuns: Array<{
    id: string
    stepId: string
    stepName: string
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
    model?: string
    startedAt?: string
    completedAt?: string
    taskId?: string
    output?: string
  }>
}

const MODELS = [
  'Default (auto-route)',
  'gpt-4o',
  'claude-3-5-sonnet',
  'gemini-1.5-pro',
  'llama-3.1-70b',
  'mistral-large',
]

const STATUS_BADGE: Record<string, string> = {
  DRAFT:    'bg-yellow-50 text-yellow-600 border border-yellow-200',
  ACTIVE:   'bg-green-50 text-green-600 border border-green-200',
  PAUSED:   'bg-orange-50 text-orange-600 border border-orange-200',
  ARCHIVED: 'bg-red-50 text-red-600 border border-red-200',
}

const RUN_STATUS_ICON: Record<string, string> = {
  COMPLETED: '✓',
  FAILED:    '✗',
  RUNNING:   '⟳',
  PENDING:   '○',
  SKIPPED:   '—',
}

const RUN_STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-green-600',
  FAILED:    'text-red-600',
  RUNNING:   'text-blue-500 animate-spin',
  PENDING:   'text-slate-400',
  SKIPPED:   'text-slate-400',
}

function duration(start?: string, end?: string): string {
  if (!start) return ''
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Highlight {{variable}} tokens in goal templates
function highlightVariables(text: string) {
  const parts = text.split(/({{[^}]+}})/)
  return parts.map((p, i) =>
    p.startsWith('{{') ? (
      <span key={i} className="text-indigo-600 bg-indigo-50 px-0.5 rounded font-mono text-[11px]">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

// ─── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  previousSteps,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  step: WorkflowStep
  index: number
  total: number
  previousSteps: WorkflowStep[]
  onChange: (updated: WorkflowStep) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Extract variables from earlier steps' output mappings
  const availableVars = previousSteps.flatMap((s) =>
    s.outputMappings.map((m) => `{{${m.key}}}`)
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200">
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
          {step.stepNumber}
        </div>
        <input
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder={`Step ${step.stepNumber} name`}
          className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors text-xs"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors text-xs"
          >
            ▼
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 transition-colors text-xs"
          >
            {expanded ? '▲' : '▼'}
          </button>
          <button
            onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-600 transition-colors text-xs"
          >
            ×
          </button>
        </div>
      </div>

      {/* Goal template */}
      <div className="px-4 pb-3">
        <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed min-h-[2.5rem] mb-1">
          {step.goalTemplate ? highlightVariables(step.goalTemplate) : (
            <span className="text-slate-400 italic">Goal template…</span>
          )}
        </div>
        <textarea
          value={step.goalTemplate}
          onChange={(e) => onChange({ ...step, goalTemplate: e.target.value })}
          placeholder="Describe what this step should accomplish. Use {{variable}} from previous steps."
          rows={3}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none transition-colors resize-none"
        />
        {availableVars.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            Available: {availableVars.map((v, i) => (
              <button
                key={i}
                onClick={() => onChange({ ...step, goalTemplate: step.goalTemplate + ' ' + v })}
                className="text-indigo-600 hover:text-indigo-500 font-mono mr-1 transition-colors"
              >
                {v}
              </button>
            ))}
          </p>
        )}
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div className="border-t border-slate-200 px-4 py-3 space-y-4">
          {/* Model override */}
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Model Override
            </label>
            <select
              value={step.modelOverride || ''}
              onChange={(e) => onChange({ ...step, modelOverride: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none transition-colors"
            >
              {MODELS.map((m) => (
                <option key={m} value={m === 'Default (auto-route)' ? '' : m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Output mappings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Output Mappings
              </label>
              <button
                onClick={() => onChange({
                  ...step,
                  outputMappings: [...step.outputMappings, { key: '', description: '' }],
                })}
                className="text-[10px] text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                + Add
              </button>
            </div>
            {step.outputMappings.length === 0 ? (
              <p className="text-[11px] text-slate-400">No output mappings. Add one to expose values to later steps.</p>
            ) : (
              <div className="space-y-2">
                {step.outputMappings.map((m, mi) => (
                  <div key={mi} className="flex items-center gap-2">
                    <input
                      value={m.key}
                      onChange={(e) => {
                        const updated = [...step.outputMappings]
                        updated[mi] = { ...updated[mi], key: e.target.value }
                        onChange({ ...step, outputMappings: updated })
                      }}
                      placeholder="variable_name"
                      className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none font-mono"
                    />
                    <span className="text-slate-400 text-xs">→</span>
                    <input
                      value={m.description}
                      onChange={(e) => {
                        const updated = [...step.outputMappings]
                        updated[mi] = { ...updated[mi], description: e.target.value }
                        onChange({ ...step, outputMappings: updated })
                      }}
                      placeholder="extract key research findings"
                      className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none"
                    />
                    <button
                      onClick={() => {
                        const updated = step.outputMappings.filter((_, i) => i !== mi)
                        onChange({ ...step, outputMappings: updated })
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors text-xs w-4"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Run History Item ──────────────────────────────────────────────────────────

function RunHistoryItem({ run, workflowId }: { run: WorkflowRun; workflowId: string }) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()

  const statusColor = {
    COMPLETED: 'text-green-600',
    FAILED:    'text-red-600',
    RUNNING:   'text-blue-500',
  }[run.status] || 'text-slate-500'

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`text-xs font-bold w-4 ${statusColor}`}>
          {run.status === 'RUNNING' ? '⟳' : run.status === 'COMPLETED' ? '✓' : '✗'}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${statusColor}`}>{run.status}</p>
          <p className="text-[10px] text-slate-400">{relativeTime(run.startedAt)}</p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">
          {duration(run.startedAt, run.completedAt)}
        </span>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-3 space-y-2">
          {run.stepRuns.map((sr) => (
            <div key={sr.id} className="flex items-center gap-2.5">
              <span className={`text-xs font-bold w-4 shrink-0 ${RUN_STATUS_COLOR[sr.status]}`}>
                {RUN_STATUS_ICON[sr.status]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 truncate">{sr.stepName}</p>
                {sr.model && <p className="text-[10px] text-slate-400">{sr.model}</p>}
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">
                {duration(sr.startedAt, sr.completedAt)}
              </span>
              {sr.taskId && (
                <Link
                  href={`/roundtable/${sr.taskId}`}
                  className="text-[10px] text-indigo-600 hover:text-indigo-500 shrink-0 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View →
                </Link>
              )}
            </div>
          ))}
          <div className="pt-1">
            <button
              onClick={() => router.push(`/workflows/${workflowId}/runs/${run.id}`)}
              className="text-[11px] text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              Full run details →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const router                            = useRouter()
  const [workflow, setWorkflow]           = useState<Workflow | null>(null)
  const [steps, setSteps]                 = useState<WorkflowStep[]>([])
  const [runs, setRuns]                   = useState<WorkflowRun[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState('')
  const [revealSecret, setRevealSecret]   = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)
  const [copiedSecret, setCopiedSecret]   = useState(false)
  const [running, setRunning]             = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const webhookUrl = workflow ? `${apiUrl}/webhooks/workflow/${workflow.id}/trigger` : ''

  const load = useCallback(async () => {
    setLoading(true)
    const [wfRes, runsRes] = await Promise.allSettled([
      apiFetch<{ workflow: Workflow }>(`/api/v1/workflows/${params.id}`),
      apiFetch<{ runs: WorkflowRun[] }>(`/api/v1/workflows/${params.id}/runs`),
    ])
    if (wfRes.status === 'fulfilled' && wfRes.value.success && wfRes.value.data?.workflow) {
      const wf = wfRes.value.data.workflow
      setWorkflow(wf)
      setSteps(wf.steps || [])
    } else {
      router.push('/workflows')
    }
    if (runsRes.status === 'fulfilled' && runsRes.value.success && runsRes.value.data) {
      setRuns(runsRes.value.data.runs || [])
    }
    setLoading(false)
  }, [params.id, router])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!workflow) return
    setSaving(true)
    setSaveError('')
    const res = await apiFetch<{ workflow: Workflow }>(`/api/v1/workflows/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name:            workflow.name,
        description:     workflow.description,
        triggerType:     workflow.triggerType,
        status:          workflow.status,
        cronExpression:  workflow.cronExpression,
        steps:           steps.map((s, i) => ({ ...s, stepNumber: i + 1 })),
      }),
    })
    setSaving(false)
    if (res.success && res.data?.workflow) {
      setWorkflow(res.data.workflow)
    } else {
      setSaveError(res.error?.message || 'Failed to save')
    }
  }

  async function handleRunNow() {
    if (!workflow) return
    setRunning(true)
    const res = await apiFetch<{ run: { id: string } }>(`/api/v1/workflows/${params.id}/run`, {
      method: 'POST',
    })
    setRunning(false)
    if (res.success && res.data?.run) {
      router.push(`/workflows/${params.id}/runs/${res.data.run.id}`)
    }
  }

  async function handleDelete() {
    await apiFetch(`/api/v1/workflows/${params.id}`, { method: 'DELETE' })
    router.push('/workflows')
  }

  function addStep() {
    const newStep: WorkflowStep = {
      id:             `new-${Date.now()}`,
      stepNumber:     steps.length + 1,
      name:           `Step ${steps.length + 1}`,
      goalTemplate:   '',
      outputMappings: [],
    }
    setSteps((prev) => [...prev, newStep])
  }

  function updateStep(index: number, updated: WorkflowStep) {
    setSteps((prev) => prev.map((s, i) => i === index ? updated : s))
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    setSteps((prev) => {
      const arr = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr.map((s, i) => ({ ...s, stepNumber: i + 1 }))
    })
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })))
  }

  async function copyText(text: string, which: 'webhook' | 'secret') {
    try { await navigator.clipboard.writeText(text) } catch { /* fallback omitted */ }
    if (which === 'webhook') { setCopiedWebhook(true); setTimeout(() => setCopiedWebhook(false), 2000) }
    else { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!workflow) return null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/workflows" className="text-slate-500 hover:text-slate-700 transition-colors text-sm shrink-0">
            ← Workflows
          </Link>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          <input
            value={workflow.name}
            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            className="bg-transparent text-sm font-semibold text-slate-800 outline-none min-w-0 flex-1 truncate"
          />
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[workflow.status] || ''}`}>
            {workflow.status}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-xl text-xs font-medium transition-all duration-200"
          >
            {running ? '⟳' : '▶'} Run Now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-all duration-200 active:scale-95"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 rounded-xl text-xs transition-all duration-200"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">

        {/* ── Left panel: Step Builder (60%) ── */}
        <div className="flex-1 min-w-0" style={{ flexBasis: '60%' }}>

          {/* Workflow description */}
          <div className="mb-6">
            <input
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              placeholder="Describe what this workflow accomplishes…"
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm text-slate-600 placeholder-slate-400 outline-none transition-colors"
            />
          </div>

          <h2 className="text-sm font-semibold text-slate-700 mb-4">Steps</h2>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {/* Dependency arrow */}
                {index > 0 && (
                  <div className="absolute -top-3 left-[22px] w-px h-3 bg-slate-200" />
                )}
                <StepCard
                  step={step}
                  index={index}
                  total={steps.length}
                  previousSteps={steps.slice(0, index)}
                  onChange={(updated) => updateStep(index, updated)}
                  onMoveUp={() => moveStep(index, 'up')}
                  onMoveDown={() => moveStep(index, 'down')}
                  onRemove={() => removeStep(index)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={addStep}
            className="mt-4 w-full py-3 border border-dashed border-slate-300 hover:border-slate-400 rounded-2xl text-xs text-slate-400 hover:text-slate-600 transition-all duration-200"
          >
            + Add Step
          </button>

          {/* Settings panel */}
          <div className="mt-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Settings</h3>
            </div>
            <div className="px-5 py-4 space-y-5">

              {/* Trigger */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Trigger Type</label>
                <div className="flex gap-2">
                  {(['MANUAL', 'SCHEDULED', 'WEBHOOK'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setWorkflow({ ...workflow, triggerType: t })}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        workflow.triggerType === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200'
                      }`}
                    >
                      {t === 'MANUAL' ? '▶ Manual' : t === 'SCHEDULED' ? '⏰ Scheduled' : '🔗 Webhook'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cron */}
              {workflow.triggerType === 'SCHEDULED' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Cron Expression</label>
                  <input
                    value={workflow.cronExpression || ''}
                    onChange={(e) => setWorkflow({ ...workflow, cronExpression: e.target.value })}
                    placeholder="0 9 * * 1  (every Monday at 9am)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none font-mono transition-colors"
                  />
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                <div className="flex gap-2">
                  {(['DRAFT', 'ACTIVE'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setWorkflow({ ...workflow, status: s })}
                      className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                        workflow.status === s
                          ? s === 'ACTIVE' ? 'bg-green-600 text-white' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : 'bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Webhook config */}
          {workflow.triggerType === 'WEBHOOK' && (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Webhook Configuration</h3>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* URL */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-mono truncate">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => copyText(webhookUrl, 'webhook')}
                      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        copiedWebhook
                          ? 'bg-green-50 text-green-600 border border-green-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {copiedWebhook ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Secret */}
                {workflow.webhookSecret && (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Webhook Secret</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-mono truncate">
                        {revealSecret ? workflow.webhookSecret : '●●●●●●●●●●●●●●●●'}
                      </code>
                      <button
                        onClick={() => setRevealSecret((v) => !v)}
                        className="shrink-0 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-700 bg-slate-100 border border-slate-200 transition-colors"
                      >
                        {revealSecret ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        onClick={() => copyText(workflow.webhookSecret!, 'secret')}
                        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                          copiedSecret
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-800'
                        }`}
                      >
                        {copiedSecret ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Example curl */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Example</label>
                  <pre className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: ${workflow.webhookSecret ? '...' : '<secret>'}" \\
  -d '{"key": "value"}'`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: Run History (40%) ── */}
        <div style={{ flexBasis: '40%', minWidth: 0 }}>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Run History</h2>

          {runs.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <p className="text-slate-400 text-sm">No runs yet.</p>
              <p className="text-xs text-slate-300 mt-1">Run this workflow to see history here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <RunHistoryItem key={run.id} run={run} workflowId={params.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
