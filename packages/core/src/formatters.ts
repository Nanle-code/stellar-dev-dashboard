export function formatXLM(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

export function shortAddress(addr: string | null | undefined, chars = 6): string {
  if (!addr) return '';
  if (addr.length <= chars * 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatStroops(stroops: unknown): string {
  const num = typeof stroops === 'number' ? stroops : parseInt(String(stroops), 10);
  if (isNaN(num)) return '—';
  const xlm = (num / 10000000).toFixed(7);
  return `${xlm} XLM (${num.toLocaleString('en-US')} stroops)`;
}

export function formatInstructions(instructions: number): string {
  if (instructions < 1000) return `${instructions}`;
  if (instructions < 1000000) return `${(instructions / 1000).toFixed(2)}K`;
  return `${(instructions / 1000000).toFixed(2)}M`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}