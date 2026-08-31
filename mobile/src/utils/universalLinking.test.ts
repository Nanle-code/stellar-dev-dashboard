import { parseUniversalLink, isValidUniversalLinkTarget } from './universalLinking'

describe('universalLinking', () => {
  it('primary flow: resolves a valid account deep link', () => {
    const result = parseUniversalLink('https://dashboard.stellar.org/account/GBXGQJW...')

    expect(result).toEqual({
      type: 'account',
      accountId: 'GBXGQJW...',
      network: 'mainnet',
      path: '/account/GBXGQJW...',
    })
  })

  it('boundary case: accepts a transaction deep link with a network prefix and query fallback', () => {
    const result = parseUniversalLink('stellar://testnet/tx/abc123?transaction=abc123')

    expect(result).toMatchObject({
      type: 'transaction',
      transactionHash: 'abc123',
      network: 'testnet',
    })
  })

  it('failure case: rejects unsupported schemes and malformed targets', () => {
    expect(() => parseUniversalLink('mailto:help@example.com')).toThrow('Unsupported environment')
    expect(() => parseUniversalLink('https://dashboard.stellar.org/account/')).toThrow('Invalid universal link')
  })

  it('validates link targets before parsing', () => {
    expect(isValidUniversalLinkTarget('stellar://account/GBXGQJW...')).toBe(true)
    expect(isValidUniversalLinkTarget('https://example.com/nope')).toBe(false)
  })
})
