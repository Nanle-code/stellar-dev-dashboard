import { describe, expect, it } from 'vitest';
import {
  classifyEndpoint,
  horizonResponse,
  sorobanResponse,
} from '../../../e2e/contract-interaction/fixtures';

const APP = ['http://localhost:5173', 'http://localhost:4173'];

describe('classifyEndpoint', () => {
  it('routes app assets, soroban and horizon separately (primary flow)', () => {
    expect(classifyEndpoint('http://localhost:5173/assets/index.js', APP)).toBe('app');
    expect(classifyEndpoint('https://soroban-testnet.stellar.org', APP)).toBe('soroban');
    expect(classifyEndpoint('https://horizon-testnet.stellar.org/accounts', APP)).toBe('horizon');
    expect(classifyEndpoint('https://api.example.com/v1/rpc', APP)).toBe('soroban');
  });

  it('falls back to "other" for unrelated and malformed URLs (boundary)', () => {
    expect(classifyEndpoint('https://prices.example.com/ticker', APP)).toBe('other');
    expect(classifyEndpoint('not a url', APP)).toBe('other');
    expect(classifyEndpoint('', APP)).toBe('other');
  });
});

describe('sorobanResponse', () => {
  it('returns a simulation result with XDR for simulateTransaction', () => {
    const response = sorobanResponse({ id: 7, method: 'simulateTransaction' }) as any;
    expect(response.id).toBe(7);
    expect(response.result.results[0].xdr.startsWith('AAAA')).toBe(true);
    expect(response.result.cost.cpuInsns).toBe('1000');
  });

  it('returns ledger metadata for getLatestLedger', () => {
    const response = sorobanResponse({ id: 1, method: 'getLatestLedger' }) as any;
    expect(response.result.sequence).toBe(1234);
    expect(response.result.protocolVersion).toBe(22);
  });

  it('handles a missing / malformed request body (boundary)', () => {
    const response = sorobanResponse(null) as any;
    expect(response.id).toBe(1);
    expect(Array.isArray(response.result.entries)).toBe(true);
  });

  it('returns a JSON-RPC error in failure mode (failure path)', () => {
    const response = sorobanResponse({ id: 2, method: 'simulateTransaction' }, { simulateError: true }) as any;
    expect(response.error.code).toBe(-32000);
    expect(response.error.message).toMatch(/trapped/i);
    expect(response.result).toBeUndefined();
  });
});

describe('horizonResponse', () => {
  it('returns an empty embedded record set', () => {
    const response = horizonResponse('/accounts') as any;
    expect(response._embedded.records).toEqual([]);
  });
});
