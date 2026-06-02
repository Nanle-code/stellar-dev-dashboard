const AUDIT_LOG_KEY = 'wallet-security-audit-log'

export function detectPhishingRisk(input = '') {
  const value = String(input || '').trim().toLowerCase()

  if (!value) {
    return { safe: true, reason: 'No destination provided.' }
  }

  const suspiciousTerms = ['xn--', 'freighter-wallet', 'stellarr', 'sorobann', 'login-verify']
  const matched = suspiciousTerms.find((term) => value.includes(term))

  if (matched) {
    return {
      safe: false,
      reason: `Potential phishing marker detected: ${matched}`,
    }
  }

  return {
    safe: true,
    reason: 'No known phishing markers detected.',
  }
}

export function buildTransactionConfirmationSummary(payload = {}) {
  return {
    network: payload.network || 'testnet',
    operationCount: payload.operationCount || 0,
    totalAmount: payload.totalAmount || '0',
    destination: payload.destination || 'N/A',
    memo: payload.memo || '(none)',
    riskLevel: payload.riskLevel || 'low',
    generatedAt: new Date().toISOString(),
  }
}

export function appendSecurityAuditLog(entry) {
  if (typeof localStorage === 'undefined') return []

  const nextEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: entry?.action || 'unknown_action',
    status: entry?.status || 'info',
    details: entry?.details || '',
  }

  const current = readSecurityAuditLog()
  const updated = [nextEntry, ...current].slice(0, 50)
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated))
  return updated
}

export function readSecurityAuditLog() {
  if (typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getSessionSecurityPosture({ walletType, mode, phishingSafe }) {
  const factors = []
  let score = 50

  if (walletType === 'ledger') {
    score += 30
    factors.push('Hardware wallet native signing')
  }

  if (mode === 'watch-only') {
    score += 10
    factors.push('Watch-only mode avoids in-app signing')
  }

  if (!phishingSafe) {
    score -= 35
    factors.push('Potential phishing signal detected')
  }

  if (score >= 80) return { tier: 'high', score, factors }
  if (score >= 60) return { tier: 'medium', score, factors }
  return { tier: 'elevated-risk', score, factors }
}
