// Browser-compatible shim — the real CJS module only runs in Node (training/server).
// In the browser bundle we export a no-op class so the import chain doesn't break.
let IsolationForest: any;

if (typeof window === 'undefined') {
  // Node environment (training scripts, server-side)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IsolationForest = require('./isolation_forest.cjs').IsolationForest;
} else {
  IsolationForest = class {
    fit() { return this; }
    predict() { return []; }
    score() { return 0; }
    save() {}
    static load() { return new IsolationForest(); }
  };
}

export { IsolationForest };
