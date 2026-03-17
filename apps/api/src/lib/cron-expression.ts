/**
 * Cron Expression Utilities — Enterprise Grade
 *
 * Converts human-readable schedules to cron expressions and computes next run times.
 * Supports timezones (critical for Indian market — IST = Asia/Kolkata).
 *
 * Uses a pure implementation — no heavy cron library dependency.
 */

export interface ParsedSchedule {
  cronExpression: string
  humanLabel:     string
  timezone:       string
}

// ─── Preset schedules ─────────────────────────────────────────────────────────

export const SCHEDULE_PRESETS: Record<string, ParsedSchedule> = {
  'every_day_9am':     { cronExpression: '0 9 * * *',   humanLabel: 'Every day at 9:00 AM',       timezone: 'Asia/Kolkata' },
  'every_weekday_9am': { cronExpression: '0 9 * * 1-5', humanLabel: 'Every weekday at 9:00 AM',   timezone: 'Asia/Kolkata' },
  'every_monday':      { cronExpression: '0 9 * * 1',   humanLabel: 'Every Monday at 9:00 AM',    timezone: 'Asia/Kolkata' },
  'every_friday':      { cronExpression: '0 9 * * 5',   humanLabel: 'Every Friday at 9:00 AM',    timezone: 'Asia/Kolkata' },
  'weekly_sunday':     { cronExpression: '0 9 * * 0',   humanLabel: 'Every Sunday at 9:00 AM',    timezone: 'Asia/Kolkata' },
  'twice_weekly':      { cronExpression: '0 9 * * 1,4', humanLabel: 'Monday & Thursday at 9:00 AM', timezone: 'Asia/Kolkata' },
  'monthly_1st':       { cronExpression: '0 9 1 * *',   humanLabel: 'First of every month',       timezone: 'Asia/Kolkata' },
  'monthly_15th':      { cronExpression: '0 9 15 * *',  humanLabel: '15th of every month',        timezone: 'Asia/Kolkata' },
  'every_6_hours':     { cronExpression: '0 */6 * * *', humanLabel: 'Every 6 hours',              timezone: 'UTC' },
  'hourly':            { cronExpression: '0 * * * *',   humanLabel: 'Every hour',                 timezone: 'UTC' },
}

// ─── Human-language parser ────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

/**
 * Parse a human-readable schedule string into a cron expression.
 * Examples:
 *   "every Monday at 9am"         → "0 9 * * 1"
 *   "every day at 6:30pm"         → "30 18 * * *"
 *   "every weekday at 10am"       → "0 10 * * 1-5"
 *   "every Monday and Friday 9am" → "0 9 * * 1,5"
 *   "1st of every month at 9am"   → "0 9 1 * *"
 */
export function parseHumanSchedule(input: string): ParsedSchedule | null {
  const s = input.toLowerCase().trim()

  // Try preset match first
  for (const [, preset] of Object.entries(SCHEDULE_PRESETS)) {
    if (s.includes(preset.humanLabel.toLowerCase())) return preset
  }

  // Extract time
  const timeMatch = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  let hour = 9
  let minute = 0
  if (timeMatch) {
    hour = parseInt(timeMatch[1])
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    if (timeMatch[3] === 'pm' && hour < 12) hour += 12
    if (timeMatch[3] === 'am' && hour === 12) hour = 0
  }

  // Detect pattern
  if (s.includes('weekday') || s.includes('work day')) {
    return { cronExpression: `${minute} ${hour} * * 1-5`, humanLabel: `Every weekday at ${formatTime(hour, minute)}`, timezone: 'Asia/Kolkata' }
  }

  if (s.includes('every day') || s.includes('daily')) {
    return { cronExpression: `${minute} ${hour} * * *`, humanLabel: `Every day at ${formatTime(hour, minute)}`, timezone: 'Asia/Kolkata' }
  }

  if (s.includes('every hour') || s.includes('hourly')) {
    return { cronExpression: `${minute} * * * *`, humanLabel: 'Every hour', timezone: 'UTC' }
  }

  // Monthly: "1st", "15th", etc.
  const monthlyMatch = s.match(/(\d+)(st|nd|rd|th)?\s+of\s+(every\s+)?month/)
  if (monthlyMatch) {
    const day = parseInt(monthlyMatch[1])
    if (day >= 1 && day <= 28) {
      return { cronExpression: `${minute} ${hour} ${day} * *`, humanLabel: `${monthlyMatch[1]}${monthlyMatch[2] ?? ''} of every month at ${formatTime(hour, minute)}`, timezone: 'Asia/Kolkata' }
    }
  }

  // Day of week: "every monday", "every tuesday and friday"
  const days: number[] = []
  for (const [name, num] of Object.entries(DAY_MAP)) {
    if (s.includes(name)) days.push(num)
  }
  const uniqueDays = [...new Set(days)].sort()

  if (uniqueDays.length > 0) {
    const dayStr = uniqueDays.join(',')
    const dayNames = uniqueDays.map((d) => Object.entries(DAY_MAP).find(([k, v]) => v === d && k.length > 3)?.[0] ?? `day ${d}`)
    return {
      cronExpression: `${minute} ${hour} * * ${dayStr}`,
      humanLabel:     `Every ${dayNames.join(' & ')} at ${formatTime(hour, minute)}`,
      timezone:       'Asia/Kolkata',
    }
  }

  return null
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  const m = minute.toString().padStart(2, '0')
  return `${h}:${m} ${period}`
}

// ─── Next run computation ─────────────────────────────────────────────────────

/**
 * Compute the next run time for a cron expression from a given date.
 * Pure implementation — works with standard 5-field cron.
 * Format: minute hour dayOfMonth month dayOfWeek
 */
export function getNextRunTime(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Invalid cron: "${cronExpression}"`)

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts

  // Start one minute after fromDate
  const candidate = new Date(fromDate)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  // Limit search to 2 years (catch impossible expressions)
  const limit = new Date(fromDate)
  limit.setFullYear(limit.getFullYear() + 2)

  while (candidate < limit) {
    if (!matchField(monthExpr, candidate.getMonth() + 1, 1, 12)) {
      candidate.setMonth(candidate.getMonth() + 1)
      candidate.setDate(1)
      candidate.setHours(0, 0, 0, 0)
      continue
    }
    if (!matchField(domExpr, candidate.getDate(), 1, 31) ||
        !matchField(dowExpr, candidate.getDay(), 0, 6)) {
      candidate.setDate(candidate.getDate() + 1)
      candidate.setHours(0, 0, 0, 0)
      continue
    }
    if (!matchField(hourExpr, candidate.getHours(), 0, 23)) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!matchField(minuteExpr, candidate.getMinutes(), 0, 59)) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0)
      continue
    }
    return new Date(candidate)
  }

  throw new Error(`No valid next run found for cron: "${cronExpression}"`)
}

function matchField(expr: string, value: number, min: number, max: number): boolean {
  if (expr === '*') return true

  for (const part of expr.split(',')) {
    // Step: */5 or 1-5/2
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    if (stepMatch) {
      const step = parseInt(stepMatch[2])
      const range = stepMatch[1] === '*' ? `${min}-${max}` : stepMatch[1]
      const [lo, hi] = range.includes('-') ? range.split('-').map(Number) : [min, max]
      for (let v = lo; v <= hi; v += step) {
        if (v === value) return true
      }
      continue
    }
    // Range: 1-5
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number)
      if (value >= lo && value <= hi) return true
      continue
    }
    // Exact
    if (parseInt(part) === value) return true
  }
  return false
}

/**
 * Validate a cron expression. Returns error message or null if valid.
 */
export function validateCronExpression(expr: string): string | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return 'Cron must have exactly 5 fields: minute hour day month weekday'
  try {
    getNextRunTime(expr)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid cron expression'
  }
}
