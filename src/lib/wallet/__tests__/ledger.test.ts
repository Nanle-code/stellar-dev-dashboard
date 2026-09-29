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

    expect(fakeApp.signTransaction).toHaveBeenCalledWith("44'/148'/7'", expect.anything());
    const parsed = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    expect(parsed.signatures.length).toBeGreaterThan(0);
    const hintVal =
      parsed.signatures[0].hint?.value ||
      (typeof parsed.signatures[0].hint === 'function'
        ? parsed.signatures[0].hint()
        : parsed.signatures[0].hint);
    expect(hintVal.length).toBeGreaterThan(0);
  });

  it('boundary case: signs with high account index in BIP-44 path', async () => {
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
      "44'/148'/255'"
    );

    expect(fakeApp.signTransaction).toHaveBeenCalledWith("44'/148'/255'", expect.anything());
    expect(signedXdr).toBeTruthy();
  });

  it('threat model: rejects derivation path manipulation outside BIP-44 Stellar specification', async () => {
    const { xdr, source } = makeUnsignedTx();
    const fakeApp = { signTransaction: vi.fn() };

    // Attacker attempts to derive along Ethereum path
    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, source.publicKey(), "44'/60'/0'")
    ).rejects.toThrowError(/Invalid Ledger derivation path/i);

    // Attacker attempts path injection
    await expect(
      signXdrWithLedger(
        xdr,
        NETWORK_PASSPHRASE,
        fakeApp,
        source.publicKey(),
        'invalid-path-injection'
      )
    ).rejects.toThrowError(/Invalid Ledger derivation path/i);
  });

  it('threat model: rejects spoofed or corrupted public key', async () => {
    const { xdr } = makeUnsignedTx();
    const fakeApp = { signTransaction: vi.fn() };

    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, 'SPOOFED_OR_INVALID_PUBLIC_KEY')
    ).rejects.toThrowError('A valid public key is required to attach the Ledger signature.');
  });

  it('rejects empty network passphrases with a clear validation message', async () => {
    const { xdr, source } = makeUnsignedTx();

    await expect(
      signXdrWithLedger(xdr, '', { signTransaction: vi.fn() }, source.publicKey())
    ).rejects.toThrowError('Network passphrase is required.');
  });

  it('failure case: surfaces a Ledger rejection (0x6985) without leaking implementation details', async () => {
    const { xdr, source } = makeUnsignedTx();
    const fakeApp = {
      signTransaction: vi.fn().mockRejectedValue(new Error('0x6985: user rejected transaction')),
    };

    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, source.publicKey())
    ).rejects.toThrowError('Transaction was rejected on the Ledger device.');
  });

  it('failure case: surfaces locked device error (0x6b0c)', async () => {
    const { xdr, source } = makeUnsignedTx();
    const fakeApp = {
      signTransaction: vi.fn().mockRejectedValue(new Error('0x6b0c: device locked')),
    };

    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, source.publicKey())
    ).rejects.toThrowError('Ledger device is locked. Unlock it and open the Stellar app.');
  });

  it('failure case: surfaces Stellar app closed error (0x6d00)', async () => {
    const { xdr, source } = makeUnsignedTx();
    const fakeApp = {
      signTransaction: vi.fn().mockRejectedValue(new Error('0x6d00: app not open')),
    };

    await expect(
      signXdrWithLedger(xdr, NETWORK_PASSPHRASE, fakeApp, source.publicKey())
    ).rejects.toThrowError('Stellar app is not open on the Ledger device.');
  });
});
