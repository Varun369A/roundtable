const fs = require('fs')
const path = require('path')

// Parse .env manually (tolerates non-standard comment styles like X#)
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const vars = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    if (!key || key.includes(' ')) continue
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip inline comments (e.g. value # comment)
    const commentIdx = val.search(/\s+#/)
    if (commentIdx !== -1) val = val.slice(0, commentIdx).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    vars[key] = val
  }
  return vars
}

const envVars = parseEnvFile(path.join(__dirname, '.env'))

// tsx is hoisted to monorepo root in Turborepo — check multiple locations
function findTsx() {
  const candidates = [
    path.join(__dirname, 'node_modules', '.bin', 'tsx'),
    path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsx'),
    path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'tsx'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return 'tsx' // fallback to PATH
}

module.exports = {
  apps: [
    {
      name: 'arivarangam-api',
      script: 'src/server.ts',
      interpreter: findTsx(),
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        ...envVars,
      },
      max_memory_restart: '600M',
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
