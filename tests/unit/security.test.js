import { describe, expect, it } from 'vitest'
import { redactSensitive } from '../../src/utils/security.js'

describe('redactSensitive', () => {
  it('redacts nested sensitive fields in objects', () => {
    const input = {
      apiKey: '12345',
      secret: 'hidden',
      nested: {
        password: 'hunter2',
        token: 'Bearer abc123',
        normal: 'value',
      },
    }

    const result = redactSensitive(input)

    expect(result.apiKey).toBe('[REDACTED]')
    expect(result.secret).toBe('[REDACTED]')
    expect(result.nested.password).toBe('[REDACTED]')
    expect(result.nested.token).toBe('[REDACTED]')
    expect(result.nested.normal).toBe('value')
  })

  it('redacts Stellar secret keys found in strings', () => {
    const secretString = 'Use key SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA for auth'
    const result = redactSensitive(secretString)

    expect(result).toContain('[REDACTED_SECRET_KEY]')
    expect(result).not.toContain('SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
  })

  it('redacts authorization bearer tokens inside strings', () => {
    const result = redactSensitive('Authorization: Bearer my-secret-token')

    expect(result).toBe('Authorization: Bearer [REDACTED]')
  })
})
