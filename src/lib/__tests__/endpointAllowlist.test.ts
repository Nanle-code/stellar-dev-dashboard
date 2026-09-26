import { describe, expect, it, vi } from 'vitest';
import { requireAllowedEndpoint, validateEndpointUrl } from '../endpointAllowlist';

describe('endpoint allowlist', () => {
  it('allows HTTPS endpoints on the home domain or its subdomains', () => {
    expect(validateEndpointUrl('https://api.anchor.example/federation', 'anchor.example', [])).toEqual({
      allowed: true,
      hostname: 'api.anchor.example',
    });
  });

  it('does not confuse a lookalike suffix with a subdomain', () => {
    const result = validateEndpointUrl(
      'https://anchor.example.phishing.test/sep10',
      'anchor.example',
      []
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not on the endpoint allowlist');
  });

  it('allows an explicitly configured cross-domain endpoint', () => {
    expect(
      validateEndpointUrl('https://shared.stellar-services.example/sep24', 'anchor.example', [
        'stellar-services.example',
      ]).allowed
    ).toBe(true);
  });

  it.each([
    ['malformed input', 'not a url', 'Endpoint URL is malformed.'],
    ['unsupported HTTP environment', 'http://anchor.example/sep10', 'Only HTTPS endpoints are supported.'],
    ['embedded credentials', 'https://user:secret@anchor.example/sep10', 'must not contain credentials'],
  ])('blocks %s and emits a warning', (_case, endpoint, reason) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => requireAllowedEndpoint(endpoint, 'anchor.example', 'SEP')).toThrow(reason);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
