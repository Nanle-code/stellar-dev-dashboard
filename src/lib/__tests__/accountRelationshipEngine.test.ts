import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  analyzeRelationships,
  getRelationshipsForAddress,
  saveAnnotation,
  removeAnnotation,
  getAnnotation,
  type EnhancedRelationshipReport,
} from '../accountRelationshipEngine'

const mockOperations = [
  {
    type: 'payment',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GBOB1234567890123456789012345678901234567890123456',
    amount: '100',
    asset_code: 'XLM',
    created_at: '2026-06-01T10:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
    memo: 'invoice-001',
  },
  {
    type: 'payment',
    from: 'GBOB1234567890123456789012345678901234567890123456',
    to: 'GALICE12345678901234567890123456789012345678901234',
    amount: '50',
    asset_code: 'XLM',
    created_at: '2026-06-05T14:00:00Z',
    source_account: 'GBOB1234567890123456789012345678901234567890123456',
    memo: 'payment',
  },
  {
    type: 'manage_sell_offer',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GARY12345678901234567890123456789012345678901234567',
    amount: '5000',
    asset_code: 'XLM',
    created_at: '2026-06-10T08:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
  },
  {
    type: 'payment',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GEXCHANGE1234567890123456789012345678901234567890',
    amount: '10000',
    asset_code: 'XLM',
    created_at: '2026-06-15T16:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
  },
  {
    type: 'payment',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GEXCHANGE1234567890123456789012345678901234567890',
    amount: '25000',
    asset_code: 'USDC',
    created_at: '2026-06-16T09:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
  },
  {
    type: 'payment',
    from: 'GEXCHANGE1234567890123456789012345678901234567890',
    to: 'GALICE12345678901234567890123456789012345678901234',
    amount: '5000',
    asset_code: 'XLM',
    created_at: '2026-06-17T11:00:00Z',
    source_account: 'GEXCHANGE1234567890123456789012345678901234567890',
  },
  {
    type: 'path_payment_strict_send',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GEXCHANGE1234567890123456789012345678901234567890',
    amount: '3000',
    asset_code: 'ETH',
    created_at: '2026-06-18T13:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
  },
  {
    type: 'create_account',
    from: 'GALICE12345678901234567890123456789012345678901234',
    to: 'GNEWBIE1234567890123456789012345678901234567890123',
    amount: '5',
    asset_code: 'XLM',
    created_at: '2026-07-01T10:00:00Z',
    source_account: 'GALICE12345678901234567890123456789012345678901234',
  },
]

const CENTRAL_ADDRESS = 'GALICE12345678901234567890123456789012345678901234'

describe('accountRelationshipEngine', () => {
  let report: EnhancedRelationshipReport

  beforeEach(() => {
    localStorage.clear()
    report = analyzeRelationships(mockOperations, CENTRAL_ADDRESS)
  })

  describe('analyzeRelationships', () => {
    it('should return a valid report structure', () => {
      expect(report).toBeDefined()
      expect(report.relationships).toBeDefined()
      expect(report.clusters).toBeDefined()
      expect(report.rankedNodes).toBeDefined()
      expect(report.summary).toBeDefined()
    })

    it('should detect all unique relationships', () => {
      expect(report.relationships.length).toBeGreaterThanOrEqual(4)
      const uniquePairs = new Set(report.relationships.map((r) => r.key))
      expect(uniquePairs.size).toBe(report.relationships.length)
    })

    it('should assign relationship types to all relationships', () => {
      for (const rel of report.relationships) {
        expect(rel.classification).toBeDefined()
        expect(['business', 'personal', 'exchange', 'defi', 'unknown']).toContain(rel.classification.type)
        expect(rel.classification.confidence).toBeGreaterThanOrEqual(0)
        expect(rel.classification.confidence).toBeLessThanOrEqual(1)
        expect(rel.classification.reasons.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should assign scores to all relationships', () => {
      for (const rel of report.relationships) {
        expect(rel.score).toBeGreaterThanOrEqual(0)
        expect(rel.score).toBeLessThanOrEqual(1)
      }
    })

    it('should detect communities', () => {
      for (const node of report.rankedNodes) {
        expect(typeof node.communityId).toBe('number')
      }
    })

    it('should compute betweenness centrality', () => {
      for (const node of report.rankedNodes) {
        expect(node.betweennessCentrality).toBeGreaterThanOrEqual(0)
        expect(node.betweennessCentrality).toBeLessThanOrEqual(1)
      }
    })

    it('should identify the central address in ranked nodes', () => {
      const central = report.rankedNodes.find((n) => n.isCentral)
      expect(central).toBeDefined()
      expect(central!.address).toBe(CENTRAL_ADDRESS)
    })

    it('should produce a valid summary with type breakdown', () => {
      const { summary } = report
      expect(summary.totalRelationships).toBeGreaterThan(0)
      expect(summary.typeBreakdown).toBeDefined()
      const typeSum = Object.values(summary.typeBreakdown).reduce((s: number, v: number) => s + v, 0)
      expect(typeSum).toBe(summary.totalRelationships)
    })

    it('should detect the exchange relationship with high volume and frequency', () => {
      const highVolumeRel = report.relationships.find(
        (r) => r.totalAmount >= 10000,
      )
      expect(highVolumeRel).toBeDefined()
    })

    it('should detect clusters with dominant types', () => {
      for (const cluster of report.clusters) {
        expect(cluster.size).toBeGreaterThanOrEqual(1)
        expect(cluster.density).toBeGreaterThanOrEqual(0)
        expect(cluster.density).toBeLessThanOrEqual(1)
        expect(['business', 'personal', 'exchange', 'defi', 'unknown']).toContain(cluster.dominantType)
      }
    })

    it('should maintain score ordering (highest first)', () => {
      for (let i = 1; i < report.relationships.length; i++) {
        expect(report.relationships[i].score).toBeLessThanOrEqual(report.relationships[i - 1].score)
      }
    })
  })

  describe('getRelationshipsForAddress', () => {
    it('should return only relationships involving the specified address', () => {
      const addrReport = getRelationshipsForAddress(mockOperations, CENTRAL_ADDRESS)
      for (const rel of addrReport.relationships) {
        expect(rel.addressA === CENTRAL_ADDRESS || rel.addressB === CENTRAL_ADDRESS).toBe(true)
      }
    })

    it('should return a valid report structure', () => {
      const addrReport = getRelationshipsForAddress(mockOperations, CENTRAL_ADDRESS)
      expect(addrReport.summary).toBeDefined()
      expect(addrReport.relationships.length).toBeGreaterThan(0)
    })
  })

  describe('annotations', () => {
    it('should persist annotations via localStorage', () => {
      const relKey = report.relationships[0].key
      expect(getAnnotation(relKey)).toBeUndefined()

      saveAnnotation(relKey, { type: 'business', note: 'confirmed business partner', timestamp: Date.now() })
      const retrieved = getAnnotation(relKey)
      expect(retrieved).toBeDefined()
      expect(retrieved!.type).toBe('business')
      expect(retrieved!.note).toBe('confirmed business partner')
    })

    it('should remove annotations', () => {
      const relKey = report.relationships[0].key
      saveAnnotation(relKey, { type: 'personal', note: 'friend', timestamp: Date.now() })
      expect(getAnnotation(relKey)).toBeDefined()

      removeAnnotation(relKey)
      expect(getAnnotation(relKey)).toBeUndefined()
    })

    it('should use manual annotation when present in analysis', () => {
      const relKey = report.relationships[0].key
      saveAnnotation(relKey, { type: 'defi', note: 'known defi interaction', timestamp: Date.now() })

      const updatedReport = analyzeRelationships(mockOperations, CENTRAL_ADDRESS)
      const annotatedRel = updatedReport.relationships.find((r) => r.key === relKey)
      expect(annotatedRel).toBeDefined()
      expect(annotatedRel!.classification.type).toBe('defi')
      expect(annotatedRel!.classification.confidence).toBe(1)
      expect(annotatedRel!.classification.reasons).toContain('manually annotated')
      expect(annotatedRel!.annotation).toBeDefined()
    })

    it('should handle localStorage errors gracefully', () => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => { throw new Error('storage full') })

      expect(() => saveAnnotation('test-key', { type: 'business', note: 'test', timestamp: Date.now() })).not.toThrow()
      Storage.prototype.setItem = originalSetItem
    })
  })

  describe('feature extraction', () => {
    it('should compute relationship features for each pair', () => {
      for (const rel of report.relationships) {
        expect(rel.features).toBeDefined()
        expect(typeof rel.features.txCount).toBe('number')
        expect(typeof rel.features.totalAmount).toBe('number')
        expect(typeof rel.features.uniqueAssetCount).toBe('number')
        expect(typeof rel.features.isBidirectional).toBe('boolean')
        expect(typeof rel.features.avgAmount).toBe('number')
        expect(typeof rel.features.amountStdDev).toBe('number')
        expect(typeof rel.features.daySpread).toBe('number')
        expect(typeof rel.features.hourStdDev).toBe('number')
        expect(typeof rel.features.memoRatio).toBe('number')
        expect(typeof rel.features.hasContractOps).toBe('boolean')
        expect(typeof rel.features.hasPathPayments).toBe('boolean')
        expect(typeof rel.features.hasManageOffer).toBe('boolean')
        expect(typeof rel.features.hasCreateAccount).toBe('boolean')
      }
    })
  })

  describe('edges cases', () => {
    it('should handle empty operations', () => {
      const emptyReport = analyzeRelationships([], CENTRAL_ADDRESS)
      expect(emptyReport.relationships).toHaveLength(0)
      expect(emptyReport.summary.totalRelationships).toBe(0)
    })

    it('should handle missing central address', () => {
      const noCentral = analyzeRelationships(mockOperations, '')
      expect(noCentral.rankedNodes.every((n) => !n.isCentral)).toBe(true)
    })

    it('should handle operations with missing fields', () => {
      const badOps = [
        { type: 'payment', created_at: '2026-01-01T00:00:00Z' },
      ]
      expect(() => analyzeRelationships(badOps, CENTRAL_ADDRESS)).not.toThrow()
    })

    it('should avoid self-relationships', () => {
      const selfOps = [
        {
          type: 'payment',
          from: CENTRAL_ADDRESS,
          to: CENTRAL_ADDRESS,
          amount: '100',
          created_at: '2026-01-01T00:00:00Z',
          source_account: CENTRAL_ADDRESS,
        },
      ]
      const selfReport = analyzeRelationships(selfOps, CENTRAL_ADDRESS)
      expect(selfReport.relationships).toHaveLength(0)
    })
  })
})
