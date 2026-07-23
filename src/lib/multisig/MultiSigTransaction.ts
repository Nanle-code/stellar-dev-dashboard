import { TransactionBuilder, Transaction } from '@stellar/stellar-sdk';

export class MultiSigTransaction {
  public txXdr: string;
  public network: string;

  constructor(txXdr: string, network: string = 'testnet') {
    this.txXdr = txXdr;
    this.network = network;
  }

  public get transaction(): Transaction {
    return TransactionBuilder.fromXDR(this.txXdr, this.network) as Transaction;
  }
}