/**
 * Simplified integration tests for scoped user preferences
 * Tests the integration between scoped storage and user preferences
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadScopedPreferences,
  saveScopedPreferences,
  DEFAULT_PREFERENCES,
} from '../userPreferences'
import { createScope } from '../scopedStorage'

// Simple test to verify the functions exist and have correct signatures
describe('scoped user preferences integration', () => {
  it('loadScopedPreferences function exists and has correct signature', () => {
    expect(typeof loadScopedPreferences).toBe('function')
    expect(loadScopedPreferences.length).toBe(1) // Takes one parameter (scope)
  })

  it('saveScopedPreferences function exists and has correct signature', () => {
    expect(typeof saveScopedPreferences).toBe('function')
    expect(saveScopedPreferences.length).toBe(2) // Takes two parameters (prefs, scope)
  })

  it('createScope function exists and creates valid scope objects', () => {
    const scope = createScope('mainnet', 'GABC123')
    expect(scope).toEqual({
      network: 'mainnet',
      accountId: 'GABC123'
    })
  })

  it('createScope works with network-only scope', () => {
    const scope = createScope('testnet')
    expect(scope).toEqual({
      network: 'testnet',
      accountId: undefined
    })
  })

  it('scoped preferences functions are properly exported from userPreferences', () => {
    // Verify the functions are part of the public API
    expect(typeof loadScopedPreferences).toBe('function')
    expect(typeof saveScopedPreferences).toBe('function')
  })

  it('DEFAULT_PREFERENCES exists and has expected structure', () => {
    expect(DEFAULT_PREFERENCES).toBeDefined()
    expect(DEFAULT_PREFERENCES.schemaVersion).toBe(3)
    expect(DEFAULT_PREFERENCES.transactionConfirmation).toBeDefined()
    expect(DEFAULT_PREFERENCES.transactionConfirmation.confirmationEmail).toBe('')
  })
})

describe('scoped preferences validation', () => {
  it('accepts valid network values', () => {
    const validNetworks = ['mainnet', 'testnet', 'futurenet', 'local', 'custom', 'custom-profile-123']
    
    validNetworks.forEach(network => {
      const scope = createScope(network)
      expect(scope.network).toBe(network)
    })
  })

  it('accepts valid account IDs', () => {
    const validAccountIds = ['GABC123', 'GDEF456', 'GXYZ789', 'some-account-id']
    
    validAccountIds.forEach(accountId => {
      const scope = createScope('mainnet', accountId)
      expect(scope.accountId).toBe(accountId)
    })
  })
})
