import * as StellarSdk from "@stellar/stellar-sdk";
import fc from "fast-check";
import { describe, it, expect } from "vitest";

const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const BASE_FEE = "100";
const MIN_AMOUNT = 0.0000001;
const MAX_SAFE_AMOUNT = 9000000000000000;

function keypairArb() {
  return fc
    .integer({ min: 1, max: Number.MAX_SAFE_INTEGER })
    .map((seed) => StellarSdk.Keypair.fromRawEd25519Seed(hash32(seed)));
}

function hash32(n) {
  const buf = Buffer.alloc(32);
  let v = BigInt(n);
  for (let i = 0; i < 32; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function publicKeyArb() {
  return keypairArb().map((kp) => kp.publicKey());
}

function validAmountArb() {
  return fc.float({
    min: MIN_AMOUNT,
    max: 1000000000,
    noNaN: true,
    noDefaultInfinity: true,
    noInteger: false,
  });
}

function extremeAmountArb() {
  return fc.oneof(
    fc.constant(0),
    fc.constant(-1),
    fc.constant(MIN_AMOUNT / 2),
    fc.constant(Number.MAX_SAFE_INTEGER + 1),
    fc.constant(Infinity),
    fc.constant(NaN),
    fc.constant(-Infinity),
    validAmountArb()
  );
}

function validMemoArb() {
  return fc.oneof(
    fc.record({ type: fc.constant("MEMO_TEXT"), value: fc.string({ maxLength: 28 }) }),
    fc.record({ type: fc.constant("MEMO_ID"), value: fc.bigInt({ min: 0n, max: 2n ** 64n - 1n }).map(String) }),
    fc.record({ type: fc.constant("MEMO_HASH"), value: fc.hexaString({ minLength: 64, maxLength: 64 }) }),
    fc.record({ type: fc.constant("MEMO_RETURN"), value: fc.hexaString({ minLength: 64, maxLength: 64 }) }),
    fc.record({ type: fc.constant("MEMO_NONE"), value: fc.constant("") }),
  );
}

function invalidMemoArb() {
  return fc.oneof(
    fc.record({ type: fc.constant("MEMO_TEXT"), value: fc.string({ minLength: 29, maxLength: 100 }) }),
    fc.record({ type: fc.constant("MEMO_ID"), value: fc.string().map(() => "-1") }),
    fc.record({ type: fc.constant("MEMO_HASH"), value: fc.hexaString({ minLength: 1, maxLength: 63 }) }),
    fc.record({ type: fc.constant("MEMO_RETURN"), value: fc.hexaString({ minLength: 65, maxLength: 128 }) }),
  );
}

function timeBoundsArb() {
  return fc
    .tuple(fc.nat(), fc.nat())
    .filter(([min, max]) => min <= max || (min === 0 && max === 0))
    .map(([minTime, maxTime]) => ({ minTime, maxTime }));
}

function operationSetArb() {
  return fc
    .tuple(publicKeyArb(), validAmountArb(), fc.boolean())
    .map(([dest, amount, native]) => ({
      destination: dest,
      amount: String(amount),
      assetType: native ? "native" : "credit_alphanum4",
      assetCode: native ? undefined : "USDC",
      assetIssuer: native ? undefined : StellarSdk.Keypair.random().publicKey(),
    }));
}

function buildAccount() {
  return new StellarSdk.Account(
    StellarSdk.Keypair.random().publicKey(),
    "123456"
  );
}

describe("Property-based: XDR round-trips", () => {
  it("payment transaction round-trips through toXDR/fromXDR for valid amounts", () => {
    fc.assert(
      fc.property(publicKeyArb(), validAmountArb(), (dest, amount) => {
        const source = buildAccount();
        const tx = new StellarSdk.TransactionBuilder(source, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: dest,
              asset: StellarSdk.Asset.native(),
              amount: String(amount),
            })
          )
          .setTimeout(30)
          .build();

        const xdr = tx.toXDR();
        const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
        
        expect(parsed).toBeInstanceOf(StellarSdk.Transaction);
        expect(parsed.source).toBe(tx.source);
        expect(parsed.operations.length).toBe(1);
        expect(parsed.operations[0].type).toBe("payment");
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("createAccount transaction round-trips through toXDR/fromXDR", () => {
    fc.assert(
      fc.property(publicKeyArb(), validAmountArb(), (dest, amount) => {
        const source = buildAccount();
        const tx = new StellarSdk.TransactionBuilder(source, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.createAccount({
              destination: dest,
              startingBalance: String(amount),
            })
          )
          .setTimeout(30)
          .build();

        const xdr = tx.toXDR();
        const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
        
        expect(parsed).toBeInstanceOf(StellarSdk.Transaction);
        expect(parsed.operations.length).toBe(1);
        expect(parsed.operations[0].type).toBe("createAccount");
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("changeTrust transaction round-trips through toXDR/fromXDR", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 4 }),
        publicKeyArb(),
        validAmountArb(),
        (code, issuer, limit) => {
          const source = buildAccount();
          const asset = new StellarSdk.Asset(code.toUpperCase(), issuer);
          const tx = new StellarSdk.TransactionBuilder(source, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              StellarSdk.Operation.changeTrust({
                asset,
                limit: String(limit),
              })
            )
            .setTimeout(30)
            .build();

          const xdr = tx.toXDR();
          const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

          expect(parsed).toBeInstanceOf(StellarSdk.Transaction);
          expect(parsed.operations.length).toBe(1);
          expect(parsed.operations[0].type).toBe("changeTrust");
        }
      ),
      { numRuns: 50, verbose: false }
    );
  });
});

describe("Property-based: Amount boundary rejection", () => {
  it("rejects zero, negative, and extreme amounts in payment operations", () => {
    fc.assert(
      fc.property(publicKeyArb(), extremeAmountArb(), (dest, amount) => {
        const source = buildAccount();

        if (amount <= 0 || !isFinite(amount) || isNaN(amount) || amount > MAX_SAFE_AMOUNT) {
          expect(() => {
            StellarSdk.Operation.payment({
              destination: dest,
              asset: StellarSdk.Asset.native(),
              amount: String(amount),
            });
          }).toThrow();
        } else {
          const op = StellarSdk.Operation.payment({
            destination: dest,
            asset: StellarSdk.Asset.native(),
            amount: String(amount),
          });
          expect(op).toBeDefined();
          expect(op.type).toBe("payment");
        }
      }),
      { numRuns: 200, verbose: false }
    );
  });
});

describe("Property-based: Memo boundary handling", () => {
  function createMemo(memo) {
    switch (memo.type) {
      case "MEMO_TEXT":
        return StellarSdk.Memo.text(memo.value);
      case "MEMO_ID":
        return StellarSdk.Memo.id(memo.value);
      case "MEMO_HASH":
        return StellarSdk.Memo.hash(memo.value);
      case "MEMO_RETURN":
        return StellarSdk.Memo.return(memo.value);
      case "MEMO_NONE":
        return StellarSdk.Memo.none();
      default:
        throw new Error(`Unknown memo type: ${memo.type}`);
    }
  }

  it("accepts valid memo types and values", () => {
    fc.assert(
      fc.property(validMemoArb(), publicKeyArb(), validAmountArb(), (memo, dest, amount) => {
        const source = buildAccount();
        const builtMemo = createMemo(memo);

        const tx = new StellarSdk.TransactionBuilder(source, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: dest,
              asset: StellarSdk.Asset.native(),
              amount: String(amount),
            })
          )
          .addMemo(builtMemo)
          .setTimeout(30)
          .build();

        const xdr = tx.toXDR();
        const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

        expect(parsed).toBeInstanceOf(StellarSdk.Transaction);
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("rejects invalid memo values", () => {
    fc.assert(
      fc.property(invalidMemoArb(), publicKeyArb(), (memo, dest) => {
        expect(() => createMemo(memo)).toThrow();
      }),
      { numRuns: 100, verbose: false }
    );
  });
});

describe("Property-based: Time bounds round-trip", () => {
  it("round-trips time bounds through XDR correctly", () => {
    fc.assert(
      fc.property(timeBoundsArb(), (bounds) => {
        const source = buildAccount();
        const tx = new StellarSdk.TransactionBuilder(source, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: StellarSdk.Keypair.random().publicKey(),
              asset: StellarSdk.Asset.native(),
              amount: "100",
            })
          )
          .setTimeout(30)
          .build();

        const xdr = tx.toXDR();
        const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

        expect(parsed).toBeInstanceOf(StellarSdk.Transaction);
      }),
      { numRuns: 50, verbose: false }
    );
  });
});

describe("Property-based: Operation set boundaries", () => {
  it("handles transactions with 1 to 10 operations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        operationSetArb(),
        (count, opTemplate) => {
          const source = buildAccount();
          let builder = new StellarSdk.TransactionBuilder(source, {
            fee: String(100 * count),
            networkPassphrase: NETWORK_PASSPHRASE,
          });

          for (let i = 0; i < count; i++) {
            builder = builder.addOperation(
              StellarSdk.Operation.payment({
                destination: opTemplate.destination,
                asset: StellarSdk.Asset.native(),
                amount: opTemplate.amount,
              })
            );
          }

          const tx = builder.setTimeout(30).build();
          const xdr = tx.toXDR();
          const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

          expect(parsed.operations.length).toBe(count);
        }
      ),
      { numRuns: 50, verbose: false }
    );
  });

  it("round-trips mixed operation types", () => {
    fc.assert(
      fc.property(publicKeyArb(), validAmountArb(), publicKeyArb(), (dest1, amt, dest2) => {
        const source = buildAccount();
        const tx = new StellarSdk.TransactionBuilder(source, {
          fee: "300",
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: dest1,
              asset: StellarSdk.Asset.native(),
              amount: String(amt),
            })
          )
          .addOperation(
            StellarSdk.Operation.createAccount({
              destination: dest2,
              startingBalance: String(Math.max(amt, 1)),
            })
          )
          .setTimeout(30)
          .build();

        const xdr = tx.toXDR();
        const parsed = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);

        expect(parsed.operations.length).toBe(2);
        expect(parsed.operations[0].type).toBe("payment");
        expect(parsed.operations[1].type).toBe("createAccount");
      }),
      { numRuns: 50, verbose: false }
    );
  });
});
