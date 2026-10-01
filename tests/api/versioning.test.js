import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, server } from '../../api/server.js';

describe('API Versioning & Lifecycle Management (Issue #449)', () => {
  let serverInstance;
  let baseURL;

  beforeAll(() => {
    serverInstance = server.listen(0);
    const address = serverInstance.address();
    baseURL = `http://localhost:${address.port}`;
  });

  afterAll((done) => {
    serverInstance.close(done);
  });

  describe('Version Headers', () => {
    it('should include API version headers in responses for API routes', async () => {
      const response = await fetch(`${baseURL}/api/docs`);

      expect(response.headers.get('api-version')).toBe('1.0.0');
      expect(response.headers.get('x-api-version')).toBe('1.0.0');
    });

    it('should reject unsupported Accept-Version', async () => {
      const response = await fetch(`${baseURL}/api/docs`, {
        headers: { 'Accept-Version': 'v99' },
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Unsupported API version');
      expect(body.supportedVersions).toContain('v1');
    });

    it('should accept supported Accept-Version', async () => {
      const response = await fetch(`${baseURL}/api/docs`, {
        headers: { 'Accept-Version': 'v1' },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Migration Endpoints', () => {
    it('should return version information', async () => {
      const response = await fetch(`${baseURL}/api/v1/migration/version-info`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.current).toBe('1.0.0');
      expect(body.supported).toContain('v1');
      expect(body).toHaveProperty('deprecated');
      expect(body).toHaveProperty('sunset');
    });

    it('should return migration guides', async () => {
      const response = await fetch(`${baseURL}/api/v1/migration/guides`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('guides');
      expect(body).toHaveProperty('policy');
      expect(body.policy.deprecationPeriod).toContain('6 months');
    });

    it('should check version compatibility', async () => {
      const response = await fetch(`${baseURL}/api/v1/migration/compatibility/v1`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.version).toBe('v1');
      expect(body.supported).toBe(true);
    });

    it('should return breaking changes', async () => {
      const response = await fetch(`${baseURL}/api/v1/migration/breaking-changes`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('changes');
      expect(Array.isArray(body.changes)).toBe(true);
    });

    it('should return sunset policy', async () => {
      const response = await fetch(`${baseURL}/api/v1/migration/sunset-policy`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.policy).toHaveProperty('deprecationPeriod');
      expect(body.policy).toHaveProperty('enforcement');
    });
  });

  describe('Documentation Endpoint', () => {
    it('should include new endpoints in API docs', async () => {
      const response = await fetch(`${baseURL}/api/docs`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.endpoints).toHaveProperty('/api/v1/migration/guides');
      expect(body.endpoints).toHaveProperty('/api/v1/migration/version-info');
    });
  });
});
