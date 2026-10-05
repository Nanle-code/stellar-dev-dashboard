import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnchorService } from '../anchors.js';

describe('AnchorService SEP-38', () => {
  let anchorService;
  
  beforeEach(() => {
    anchorService = new AnchorService();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch SEP-38 info successfully', async () => {
    // Mock getQuoteServer implicitly by mocking fetch for toml
    const tomlResponse = {
      ok: true,
      text: () => Promise.resolve(`ANCHOR_QUOTE_SERVER="https://api.example.com/sep38"`)
    };
    
    const infoResponse = {
      ok: true,
      json: () => Promise.resolve({ assets: [{ asset: 'iso4217:USD' }] })
    };
    
    global.fetch.mockResolvedValueOnce(tomlResponse).mockResolvedValueOnce(infoResponse);
    
    // Add a mock anchor
    anchorService.anchors.set('test-anchor', { id: 'test-anchor', homeDomain: 'example.com' });
    
    const info = await anchorService.getSep38Info('test-anchor');
    expect(info.assets[0].asset).toBe('iso4217:USD');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  
  it('should handle failure when fetching SEP-38 info', async () => {
    const tomlResponse = {
      ok: true,
      text: () => Promise.resolve(`ANCHOR_QUOTE_SERVER="https://api.example.com/sep38"`)
    };
    
    const infoResponse = {
      ok: false,
      status: 500
    };
    
    global.fetch.mockResolvedValueOnce(tomlResponse).mockResolvedValueOnce(infoResponse);
    anchorService.anchors.set('test-anchor', { id: 'test-anchor', homeDomain: 'example.com' });
    
    await expect(anchorService.getSep38Info('test-anchor')).rejects.toThrow('Failed to fetch SEP-38 info: 500');
  });

  it('should request SEP-38 quote successfully', async () => {
    const tomlResponse = {
      ok: true,
      text: () => Promise.resolve(`ANCHOR_QUOTE_SERVER="https://api.example.com/sep38"`)
    };
    
    const quoteResponse = {
      ok: true,
      json: () => Promise.resolve({ id: 'quote-123', price: '1.05', expires_at: '2025-01-01T00:00:00Z' })
    };
    
    global.fetch.mockResolvedValueOnce(tomlResponse).mockResolvedValueOnce(quoteResponse);
    anchorService.anchors.set('test-anchor', { id: 'test-anchor', homeDomain: 'example.com' });
    
    const quote = await anchorService.requestSep38Quote('test-anchor', 'mock-token', 'sep31', 'iso4217:USD', 'stellar:USDC:G123', 100, 'sell');
    expect(quote.id).toBe('quote-123');
    expect(quote.price).toBe('1.05');
  });
  
  it('should throw error when missing ANCHOR_QUOTE_SERVER', async () => {
    const tomlResponse = {
      ok: true,
      text: () => Promise.resolve(`WEB_AUTH_ENDPOINT="https://auth.example.com"`)
    };
    
    global.fetch.mockResolvedValueOnce(tomlResponse);
    anchorService.anchors.set('test-anchor', { id: 'test-anchor', homeDomain: 'example.com' });
    
    await expect(anchorService.getSep38Info('test-anchor')).rejects.toThrow('does not support SEP-38 quotes');
  });
});
