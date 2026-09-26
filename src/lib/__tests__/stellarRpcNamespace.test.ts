import { describe, it, expect } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import { getSorobanServer } from '../stellar';

describe('stellar-sdk rpc namespace (#970)', () => {
  it('primary: rpc.Server is available and constructible', () => {
    expect(StellarSdk.rpc).toBeDefined();
    expect(typeof StellarSdk.rpc.Server).toBe('function');
    const server = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org');
    expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
  });

  it('boundary: Durability and Api live under rpc', () => {
    expect(StellarSdk.rpc.Durability).toBeDefined();
    expect(StellarSdk.rpc.Durability.Persistent).toBeDefined();
    expect(StellarSdk.rpc.Api).toBeDefined();
  });

  it('failure: custom network without sorobanUrl throws', () => {
    expect(() => getSorobanServer('custom')).toThrow(/Custom Soroban RPC URL/);
  });
});
