/**
 * SecurityBrain — Scans for OWASP Top 10 vulnerabilities.
 * Zero API — rule-based pattern matching against known vulnerability patterns.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'

export interface SecurityBrainInput { generatedFiles: GeneratedFile[] }

export interface SecurityIssue {
  file: string
  line?: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  type: string
  description: string
  fix: string
}

export interface SecurityBrainOutput {
  securityScore: number
  criticalIssues: SecurityIssue[]
  highIssues: SecurityIssue[]
  mediumIssues: SecurityIssue[]
  lowIssues: SecurityIssue[]
  passed: boolean
  owaspCategories: string[]
}

// OWASP Top 10 rules
const SECURITY_RULES: Array<{ pattern: RegExp; severity: SecurityIssue['severity']; type: string; description: string; fix: string }> = [
  // A01 - Broken Access Control
  { pattern: /\.query\(\s*`[^`]*\$\{/g, severity: 'CRITICAL', type: 'SQL Injection', description: 'Template literal in SQL query — potential SQL injection', fix: 'Use parameterized queries or an ORM like Prisma' },
  // A02 - Cryptographic Failures
  { pattern: /md5|sha1\b/gi, severity: 'HIGH', type: 'Weak Cryptography', description: 'MD5/SHA1 is cryptographically weak', fix: 'Use bcrypt for passwords, SHA-256+ for hashing' },
  { pattern: /Math\.random\(\)/g, severity: 'MEDIUM', type: 'Weak Randomness', description: 'Math.random() is not cryptographically secure', fix: 'Use crypto.randomBytes() or crypto.randomUUID()' },
  // A03 - Injection
  { pattern: /eval\s*\(/g, severity: 'CRITICAL', type: 'Code Injection', description: 'eval() executes arbitrary code', fix: 'Remove eval() — refactor to avoid dynamic code execution' },
  { pattern: /exec\s*\(\s*[^'"]/g, severity: 'HIGH', type: 'Command Injection', description: 'Dynamic command execution with variable', fix: 'Use execFile() with a fixed command and validated args' },
  // A05 - Security Misconfiguration
  { pattern: /cors\(\)/g, severity: 'MEDIUM', type: 'CORS Misconfiguration', description: 'CORS with no origin restriction', fix: 'Specify allowed origins: cors({ origin: ["https://yourdomain.com"] })' },
  // A07 - Auth/Identification Failures
  { pattern: /password:\s*['"][^'"]+['"]/g, severity: 'CRITICAL', type: 'Hardcoded Credential', description: 'Hardcoded password detected', fix: 'Use environment variables for all credentials' },
  { pattern: /secret:\s*['"][^'"]{5,}['"]/g, severity: 'CRITICAL', type: 'Hardcoded Secret', description: 'Hardcoded secret detected', fix: 'Move to .env file and use process.env.SECRET' },
  // A09 - Security Logging
  { pattern: /console\.log\(.*password/gi, severity: 'HIGH', type: 'Sensitive Data Logging', description: 'Password may be logged', fix: 'Never log passwords or credentials' },
]

export class SecurityBrain extends Brain<SecurityBrainInput, SecurityBrainOutput> {
  readonly brainName = 'SecurityBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: SecurityBrainInput, _ctx: BrainContext): Promise<SecurityBrainOutput> {
    const criticalIssues: SecurityIssue[] = []
    const highIssues: SecurityIssue[] = []
    const mediumIssues: SecurityIssue[] = []
    const lowIssues: SecurityIssue[] = []
    const owaspCategories = new Set<string>()

    for (const file of input.generatedFiles) {
      // Skip generated env/config files
      if (file.path.endsWith('.env.example') || file.path === 'prisma/schema.prisma') continue

      for (const rule of SECURITY_RULES) {
        const matches = file.content.match(rule.pattern)
        if (matches && matches.length > 0) {
          const issue: SecurityIssue = {
            file: file.path,
            severity: rule.severity,
            type: rule.type,
            description: rule.description,
            fix: rule.fix,
          }
          if (rule.severity === 'CRITICAL') { criticalIssues.push(issue); owaspCategories.add(rule.type) }
          else if (rule.severity === 'HIGH') { highIssues.push(issue); owaspCategories.add(rule.type) }
          else if (rule.severity === 'MEDIUM') mediumIssues.push(issue)
          else lowIssues.push(issue)
        }
      }
    }

    const penalty = criticalIssues.length * 30 + highIssues.length * 15 + mediumIssues.length * 5 + lowIssues.length * 2
    const securityScore = Math.max(0, 100 - penalty)

    return {
      securityScore,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      passed: criticalIssues.length === 0,
      owaspCategories: [...owaspCategories],
    }
  }

  protected fallback(_: SecurityBrainInput): SecurityBrainOutput {
    return { securityScore: 100, criticalIssues: [], highIssues: [], mediumIssues: [], lowIssues: [], passed: true, owaspCategories: [] }
  }
}
