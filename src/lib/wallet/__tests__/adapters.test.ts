import * as StellarSdk from '@stellar/stellar-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWalletAdapter } from '../adapters'
import { __resetFreighterApiCacheForTests } from '../freighter'

const TESTNET_PASSPHRASE = StellarSdk.Networks.TESTNET

function makeUnsignedXdr() {
  const source = StellarSdk.Keypair.random()
  return new StellarSdk.TransactionBuilder(new StellarSdk.Account(source.publicKey(), '0'), {
    fee: '100',
    networkPassphrase: TESTNET_PASSPHRASE,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: source.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: '1',
    }))
    .build()
    .toXDR()
}

describe('wallet adapters', () => {
  const signTransaction = vi.fn(async (xdr: string) => ({ signedTxXdr: `${xdr}-signed` }))
  const freighterApi = {
    isConnected: vi.fn(async () => ({ isConnected: true })),
    requestAccess: vi.fn(async () => ({ address: 'GTESTADDRESS' })),
    getAddress: vi.fn(async () => ({ address: 'GTESTADDRESS' })),
    getNetwork: vi.fn(async () => ({ network: 'TESTNET' })),
    signTransaction,
  }

  afterEach(() => {
    delete (window as any).freighterApi
    freighterApi.getNetwork.mockResolvedValue({ network: 'TESTNET' })
    vi.clearAllMocks()
    __resetFreighterApiCacheForTests()
  })

  it('connects and signs through the common adapter interface', async () => {
    ;(window as any).freighterApi = freighterApi
    const adapter = getWalletAdapter('freighter')
    const connection = await adapter.connect('testnet')
    const xdr = makeUnsignedXdr()
    const signed = await adapter.signTransaction(xdr, 'testnet')

    expect(connection).toMatchObject({ publicKey: 'GTESTADDRESS', network: 'testnet' })
    expect(signed).toBe(`${xdr}-signed`)
    expect(signTransaction).toHaveBeenCalledOnce()
  })

  it('rejects a wallet network mismatch before requesting a signature', async () => {
    ;(window as any).freighterApi = freighterApi
    await getWalletAdapter('freighter').connect('testnet')
    freighterApi.getNetwork.mockResolvedValue({ network: 'PUBLIC' })

    await expect(getWalletAdapter('freighter').signTransaction(makeUnsignedXdr(), 'testnet'))
      .rejects.toThrow('Network mismatch')
    expect(signTransaction).not.toHaveBeenCalled()
  })

  it('rejects transaction XDR for another network before calling the wallet', async () => {
    ;(window as any).freighterApi = freighterApi
    await getWalletAdapter('freighter').connect('testnet')

    await expect(getWalletAdapter('freighter').signTransaction('not-valid-xdr', 'testnet'))
      .rejects.toThrow('does not match the dashboard')
    expect(signTransaction).not.toHaveBeenCalled()
  })

  it('propagates wallet signing failures', async () => {
    ;(window as any).freighterApi = freighterApi
    await getWalletAdapter('freighter').connect('testnet')
    signTransaction.mockRejectedValueOnce(new Error('User declined signing.'))

    await expect(getWalletAdapter('freighter').signTransaction(makeUnsignedXdr(), 'testnet'))
      .rejects.toThrow('User declined signing.')
  })
})