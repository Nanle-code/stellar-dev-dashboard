/**
 * ESLint local rule: no-direct-submit (#983 Mainnet Safety Guard)
 *
 * Forbids calling server.submitTransaction() or sendTransaction() directly
 * from component code. All submit paths must go through useWriteGuard().guard()
 * so the mainnet confirmation gate is never bypassed.
 *
 * Allowed in:
 *   - src/lib/transactionBuilder.ts  (the underlying transport layer)
 *   - src/lib/contractInvoker.ts     (Soroban transport layer)
 *   - src/lib/horizonRetry.ts        (retry wrapper)
 *   - tests/**                       (test helpers may call directly)
 *
 * Everywhere else, a direct call to submitTransaction / sendTransaction is
 * flagged as an error.
 */

/** @type {import('eslint').Rule.RuleModule} */
const noDirectSubmit = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require all submit/send transaction calls to go through useWriteGuard() — #983',
      url: 'https://github.com/Nanle-code/stellar-dev-dashboard/issues/983',
    },
    messages: {
      noDirectSubmit:
        'Direct call to {{method}}() bypasses the mainnet safety guard. ' +
        'Use useWriteGuard().guard({ onConfirm }) instead, or add this file to the allowlist in eslint-rules/no-direct-submit.mjs.',
    },
    schema: [],
  },

  create(context) {
    // Files allowed to call submitTransaction/sendTransaction directly
    const ALLOWLIST = [
      'src/lib/transactionBuilder',
      'src/lib/contractInvoker',
      'src/lib/horizonRetry',
      'src/lib/bulkOperations',  // batch layer, calls signAndSubmitTransaction internally
    ];

    const filename = context.getFilename().replace(/\\/g, '/');

    // Allow test files and the transport-layer allowlist
    const isAllowed =
      filename.includes('/tests/') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      ALLOWLIST.some((allowed) => filename.includes(allowed));

    if (isAllowed) return {};

    const BLOCKED_METHODS = new Set([
      'submitTransaction',
      'sendTransaction',
      'signAndSubmitTransaction',
    ]);

    return {
      CallExpression(node) {
        const callee = node.callee;

        // Matches: server.submitTransaction(...) / sorobanServer.sendTransaction(...)
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          BLOCKED_METHODS.has(callee.property.name)
        ) {
          context.report({
            node,
            messageId: 'noDirectSubmit',
            data: { method: callee.property.name },
          });
        }

        // Matches: signAndSubmitTransaction(...)
        if (
          callee.type === 'Identifier' &&
          BLOCKED_METHODS.has(callee.name)
        ) {
          context.report({
            node,
            messageId: 'noDirectSubmit',
            data: { method: callee.name },
          });
        }
      },
    };
  },
};

export default noDirectSubmit;
