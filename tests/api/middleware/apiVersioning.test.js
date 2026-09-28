/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import {
  apiVersioningMiddleware,
  CURRENT_API_VERSION,
  withApiVersion,
} from '../../../api/middleware/apiVersioning.js'

function mockReq(overrides = {}) {
  return {
    path: '/api/v1/accounts/GABC',
    headers: {},
    ...overrides,
  }
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    _headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
    set(field, value) {
      this._headers[field.toLowerCase()] = value
      return this
    },
    setHeader(field, value) {
      this._headers[field.toLowerCase()] = value
      return this
    },
  }
  return res
}

describe('apiVersioningMiddleware', () => {
  it('adds version headers on every response', () => {
    const req = mockReq()
    const res = mockRes()
    let nextCalled = false

    apiVersioningMiddleware(req, res, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
    expect(res._headers['api-version']).toBe(CURRENT_API_VERSION)
    expect(res._headers['x-api-version']).toBe(CURRENT_API_VERSION)
  })

  it('adds deprecation headers for deprecated routes', () => {
    const req = mockReq({ path: '/api/v1/behavior/profile' })
    const res = mockRes()

    apiVersioningMiddleware(req, res, () => {})

    expect(res._headers.deprecation).toBeTruthy()
    expect(res._headers.sunset).toBeTruthy()
    expect(res._headers.link).toContain('/api/v2/behavior')
    expect(res._headers.warning).toContain('deprecated')
  })

  it('rejects unsupported Accept-Version values', () => {
    const req = mockReq({ headers: { 'accept-version': '9.9' } })
    const res = mockRes()

    apiVersioningMiddleware(req, res, () => {})

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Unsupported API version')
    expect(res.body.supportedVersions).toContain('1.0.0')
  })

  it('wraps payloads with explicit version metadata', () => {
    const payload = withApiVersion({ data: [] })
    expect(payload.apiVersion).toBe(CURRENT_API_VERSION)
    expect(payload.data).toEqual([])
  })
})
