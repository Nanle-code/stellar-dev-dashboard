const { TransactionBuilder, Account, Networks, Memo } = require('@stellar/stellar-base');
const BigNumber = require('bignumber.js');

describe('Soroban Transaction building', () => {
  const sourcePublicKey = 'GB7V7ZST6Z6XDSX5XDSX5XDSX5XDSX5XDSX5XDSX5XDSX5XDSX5XDSX5';
  const setupAccount = () => new Account(sourcePublicKey, '100');

  it('should successfully build a transaction with Soroban data', () => {
    const account = setupAccount();
    
    // Base64 encoded mock Soroban Data (Resources/Footprint)
    const mockSorobanData = 'AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    const builder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
      sorobanData: mockSorobanData
    })
    .setTimeout(30);

    // Validation check based on TransactionBuilder.build() logic in context
    const tx = builder.build();

    expect(tx.fee).toBe('100');
    expect(tx.sequence).toBe('101');
    // Check if sorobanData was correctly integrated into the XDR extension
    expect(tx._tx.ext().switch()).toBe(1); 
  });

  it('should throw error if fee is missing', () => {
    const account = setupAccount();
    expect(() => {
      new TransactionBuilder(account, { 
        networkPassphrase: Networks.TESTNET 
      });
    }).toThrow('must specify fee for the transaction (in stroops)');
  });
});