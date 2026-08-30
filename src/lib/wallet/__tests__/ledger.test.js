import { describe, it, expect, vi } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import { signXdrWithLedger } from '../ledger';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

function makeUnsignedTx() {
  const source = StellarSdk.Keypair.random();
  const tx = new StellarSdk.TransactionBuilder(new StellarSdk.Account(source.publicKey(), '0'), {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: source.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '1',
      })
    )
    .build();

  return {
    tx,
    xdr: tx.toEnvelope().toXDR('base64'),
    source,
  };
}

describe('wallet ledger signing', () => {
  it('signs a valid envelope using the selected Ledger derivation path', async () => {
    const { xdr } = makeUnsignedTx();
    const ledgerKeypair = StellarSdk.Keypair.random();
    const fakeApp = {
      signTransaction: vi.fn().mockImplementation(async (_path, txHash) => {
        const signature = ledgerKeypair.sign(txHash);
        return { signature };
      }),
    };

    const signedXdr = await signXdrWithLedger(
      xdr,
      NETWORK_PASSPHRASE,
      fakeApp,
      ledgerKeypair.publicKey(),
      "44'/148'/7'"
    );

    expect(fakeApp.signTransaction).toHaveBeenCalledWith("44'/148'/7'", expect.any(Buffer));
    const parsed = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    expect(parsed.signatures.length).toBeGreaterThan(0);
    expect(parsed.signatures[0].hint().length).toBeGreaterThan(0);
  });

  it('rejects empty network passphrases with a clear validation message', async () => {
    const { xdr, source } = makeUnsignedTx();

    await expect(
      signXdrWithLedger(xdr, '', { signTransaction: vi.fn() }, source.publicKey())
    ).rejects.toThrowError('Network passphrase is required.');
  });

  it('surfaces a Ledger rejection without leaking implementation details', async () => {
    const { xdr, source } = makeUnsignedTx();
    const fakeApp = {
      signTransaction: vi.fn().mockRejectedValue(new Error('0x6985: user rejected transaction')),
    };

    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, source.publicKey())
    ).rejects.toThrowError('Transaction was rejected on the Ledger device.');
  });
});
