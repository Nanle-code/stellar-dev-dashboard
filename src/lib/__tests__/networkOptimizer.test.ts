import { describe, it, expect, vi } from 'vitest';
import { NetworkOptimizer } from '../networkOptimizer';

describe('NetworkOptimizer', () => {
  it('should process a batch of requests and assign quality', async () => {
    const optimizer = new NetworkOptimizer();
    const req = { url: '/test', priority: 1 };
    const res = await optimizer.optimizeRequest(req);
    expect(res.status).toBe('success');
    expect(res.data).toBeDefined();
    expect(res.data.quality).toBeDefined();
    expect(res.data.url).toBe('/test');
  });
});
