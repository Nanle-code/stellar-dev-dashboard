import type { NetworkName } from '../services/stellar'

export type ParsedUniversalLink =
  | {
      type: 'account'
      accountId: string
      network: NetworkName
      path: string
    }
  | {
      type: 'transaction'
      transactionHash: string
      network: NetworkName
      path: string
    }

const SUPPORTED_HOSTS = new Set(['dashboard.stellar.org', 'www.dashboard.stellar.org'])
const SUPPORTED_SCHEMES = new Set(['stellar'])

function isNetworkName(value: string | null | undefined): value is NetworkName {
  return !!value && ['mainnet', 'testnet', 'futurenet', 'local', 'custom'].includes(value)
}

function parseNetworkFromUrl(url: URL): NetworkName {
  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()

  if (host === 'testnet' || host === 'futurenet' || host === 'local' || host === 'mainnet' || host === 'custom') {
    return host as NetworkName
  }

  if (path.startsWith('testnet/')) return 'testnet'
  if (path.startsWith('mainnet/')) return 'mainnet'
  if (path.startsWith('futurenet/')) return 'futurenet'
  if (path.startsWith('local/')) return 'local'
  if (path.startsWith('custom/')) return 'custom'

  if (url.protocol === 'stellar:') {
    const authority = url.host || ''
    if (authority) {
      const candidate = authority.toLowerCase()
      if (isNetworkName(candidate)) {
        return candidate
      }
    }
  }

  return 'mainnet'
}

function normalizePathSegment(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed !== '' ? trimmed : null
}

export function parseUniversalLink(input: string): ParsedUniversalLink {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('Invalid universal link')
  }

  const trimmed = input.trim()
  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Invalid universal link')
  }

  const protocol = url.protocol.toLowerCase()
  if (protocol === 'https:' || protocol === 'http:') {
    if (!SUPPORTED_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error('Unsupported environment')
    }
  } else if (protocol === 'stellar:') {
    if (!SUPPORTED_SCHEMES.has(url.protocol.replace(':', ''))) {
      throw new Error('Unsupported environment')
    }
  } else {
    throw new Error('Unsupported environment')
  }

  const network = parseNetworkFromUrl(url)
  const segments = url.pathname.split('/').filter(Boolean)
  const firstSegment = normalizePathSegment(segments[0])
  const secondSegment = normalizePathSegment(segments[1])
  const hostname = url.hostname.toLowerCase()
  const queryAccount = normalizePathSegment(url.searchParams.get('account') ?? url.searchParams.get('accountId'))
  const queryTransaction = normalizePathSegment(url.searchParams.get('transaction') ?? url.searchParams.get('tx'))

  if (hostname === 'account' || firstSegment === 'account') {
    const accountId = secondSegment ?? (hostname === 'account' ? normalizePathSegment(url.pathname.replace(/^\/+|\/+$/g, '')) : queryAccount)
    if (!accountId) {
      throw new Error('Invalid universal link')
    }

    return {
      type: 'account',
      accountId,
      network,
      path: url.pathname || `/account/${accountId}`,
    }
  }

  if (hostname === 'tx' || hostname === 'transaction' || hostname === 'transactions' || firstSegment === 'tx' || firstSegment === 'transaction' || firstSegment === 'transactions') {
    const transactionHash = secondSegment ?? (hostname === 'tx' || hostname === 'transaction' || hostname === 'transactions' ? normalizePathSegment(url.pathname.replace(/^\/+|\/+$/g, '')) : queryTransaction)
    if (!transactionHash) {
      throw new Error('Invalid universal link')
    }

    return {
      type: 'transaction',
      transactionHash,
      network,
      path: url.pathname || `/tx/${transactionHash}`,
    }
  }

  if (queryAccount) {
    return {
      type: 'account',
      accountId: queryAccount,
      network,
      path: url.pathname || `/account/${queryAccount}`,
    }
  }

  if (queryTransaction) {
    return {
      type: 'transaction',
      transactionHash: queryTransaction,
      network,
      path: url.pathname || `/tx/${queryTransaction}`,
    }
  }

  throw new Error('Invalid universal link')
}

export function isValidUniversalLinkTarget(input: string): boolean {
  if (typeof input !== 'string' || !input.trim()) {
    return false
  }

  try {
    parseUniversalLink(input)
    return true
  } catch {
    return false
  }
}
