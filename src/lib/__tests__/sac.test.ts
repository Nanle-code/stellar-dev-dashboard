import { describe, expect, it } from 'vitest'
import { Asset, Networks } from '@stellar/stellar-sdk'
import { createSacDeploymentOperation, getSacContractId } from '../sac'

describe('SAC helpers', () => {
  it('derives network-specific IDs for native and issued assets', () => {
    expect(getSacContractId({ asset_type: 'native' }, 'testnet')).toBe(Asset.native().contractId(Networks.TESTNET))
    const asset = { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }
    expect(getSacContractId(asset, 'testnet')).toMatch(/^C/)
    expect(getSacContractId(asset, 'testnet')).not.toBe(getSacContractId(asset, 'mainnet'))
  })

  it('creates the protocol SAC deployment operation', () => {
    const operation = createSacDeploymentOperation({ asset_type: 'native' })
    expect(operation.type).toBe('invokeHostFunction')
  })
})
