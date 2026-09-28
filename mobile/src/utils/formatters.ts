export function shortAddress(addr: string | null | undefined, chars = 6): string {
  if (!addr) return ''
  return `${addr.slice(0, chars)}\u2026${addr.slice(-chars)}`
}

export function formatXLM(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
