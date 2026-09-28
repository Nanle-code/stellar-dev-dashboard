/**
 * @vitest-environment node
 *
 * Regression tests for the browser/Node dependency split (#963).
 *
 * These cover the primary flow (the real workspace is separated), a boundary
 * case (server deps hidden in an unexpected section), and a failure case (a web
 * package that declares a server-only runtime dependency).
 */
import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_ROOT_DEPS,
  WorkspaceBoundaryError,
  findForbiddenRootDeps,
  assertNoForbiddenRootDeps,
  validateWorkspace,
} from '../../scripts/validate-workspace-boundaries.mjs';

describe('workspace dependency boundaries', () => {
  it('primary flow: web package is free of server-only deps and members are wired', () => {
    const result = validateWorkspace();

    expect(result.ok).toBe(true);
    expect(result.root.name).toBe('stellar-dev-dashboard');
    expect(result.members.map((member) => member.name)).toEqual(['api', 'ml']);

    for (const dep of FORBIDDEN_ROOT_DEPS) {
      expect(result.root.dependencies?.[dep]).toBeUndefined();
      expect(result.root.optionalDependencies?.[dep]).toBeUndefined();
      expect(result.root.devDependencies?.[dep]).toBeUndefined();
    }
  });

  it('boundary case: server deps hidden in devDependencies are still detected', () => {
    expect(findForbiddenRootDeps({ devDependencies: { express: '^4.18.2' } })).toEqual(['express']);
    expect(findForbiddenRootDeps({ dependencies: { react: '^18.3.0' } })).toEqual([]);
  });

  it('failure case: declaring a server-only runtime dep throws a boundary error', () => {
    expect(() => assertNoForbiddenRootDeps({ dependencies: { ws: '^8.16.0' } })).toThrow(
      WorkspaceBoundaryError
    );
    expect(() => assertNoForbiddenRootDeps({ optionalDependencies: { ioredis: '^5.4.0' } })).toThrow(
      /ioredis/
    );
  });
});
