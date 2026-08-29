export const STROOPS_PER_XLM = 10_000_000n

export function stroopsToXLM(stroops: bigint | number): string {
  const stroopsBigInt = typeof stroops === 'number' ? BigInt(Math.trunc(stroops)) : stroops
  if (stroopsBigInt < 0n) {
    throw new Error('Stroop value cannot be negative')
  }
  const whole = stroopsBigInt / STROOPS_PER_XLM
  const remainder = stroopsBigInt % STROOPS_PER_XLM
  const remainderStr = remainder.toString().padStart(7, '0')
  return `${whole.toString()}.${remainderStr}`
}

export function xlmToStroops(xlm: string | number): bigint {
  const xlmStr = typeof xlm === 'number' ? xlm.toString() : xlm
  if (!xlmStr || typeof xlmStr !== 'string') {
    throw new Error('Invalid XLM value: input must be a string or number')
  }
  const trimmed = xlmStr.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid XLM value: "${xlmStr}" is not numeric`)
  }
  const parts = trimmed.split('.')
  if (parts[1]?.length > 7) {
    throw new Error(`Invalid XLM value: "${xlmStr}" has more than 7 decimal places`)
  }
  const wholePart = BigInt(parts[0] || '0')
  let fractionalPart = parts[1] || ''
  while (fractionalPart.length < 7) {
    fractionalPart += '0'
  }
  fractionalPart = fractionalPart.slice(0, 7)
  const fractionalBigInt = BigInt(fractionalPart)
  return wholePart * STROOPS_PER_XLM + fractionalBigInt
}

export function formatStroops(stroops: bigint | number): string {
  const stroopsBigInt = typeof stroops === 'number' ? BigInt(Math.trunc(stroops)) : stroops
  const xlm = stroopsToXLM(stroopsBigInt)
  return `${xlm} XLM (${stroopsBigInt.toLocaleString()} stroops)`
}

export function parseStroops(stroopsStr: string): bigint {
  const trimmed = stroopsStr.trim()
  const match = trimmed.match(/^([\d.]+)\s*(?:XLM)?$/i)
  if (!match) {
    throw new Error(`Invalid stroops format: "${stroopsStr}"`)
  }
  return xlmToStroops(match[1])
}
