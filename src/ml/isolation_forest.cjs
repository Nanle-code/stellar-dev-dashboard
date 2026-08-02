// Simple Isolation Forest implementation (approximate)
const fs = require('fs');

function c(n) {
  if (n <= 1) return 0;
  // approximate harmonic number H(n-1)
  const H = Math.log(n - 1) + 0.5772156649 + 1 / (2 * (n - 1));
  return 2 * H - 2 * (n - 1) / n;
}

function rangeMinMax(data, dim) {
  let mn = Infinity, mx = -Infinity;
  for (const d of data) {
    const v = d[dim];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [mn, mx];
}

function buildTree(data, heightLimit) {
  if (data.length <= 1 || heightLimit <= 0) {
    return { size: data.length, leaf: true };
  }
  const dim = Math.floor(Math.random() * data[0].length);
  const [mn, mx] = rangeMinMax(data, dim);
  if (mn === mx) return { size: data.length, leaf: true };
  const split = Math.random() * (mx - mn) + mn;
  const left = [], right = [];
  for (const d of data) {
    if (d[dim] < split) left.push(d);
    else right.push(d);
  }
  return { leaf: false, dim, split, left: buildTree(left, heightLimit - 1), right: buildTree(right, heightLimit - 1) };
}

function pathLength(x, tree, currentDepth = 0) {
  if (!tree || tree.leaf) return currentDepth + c(tree ? tree.size : 0);
  if (x[tree.dim] < tree.split) return pathLength(x, tree.left, currentDepth + 1);
  return pathLength(x, tree.right, currentDepth + 1);
}

class IsolationForest {
  constructor(nTrees = 50, sampleSize = 256) {
    this.nTrees = nTrees;
    this.sampleSize = sampleSize;
    this.trees = [];
  }

  fit(data) {
    // expecting data as array of numeric arrays
    this.trees = [];
    const heightLimit = Math.ceil(Math.log2(this.sampleSize));
    for (let i = 0; i < this.nTrees; i++) {
      // sample without replacement
      const sample = [];
      const idx = new Set();
      while (sample.length < Math.min(this.sampleSize, data.length)) {
        const r = Math.floor(Math.random() * data.length);
        if (!idx.has(r)) { idx.add(r); sample.push(data[r]); }
      }
      this.trees.push(buildTree(sample, heightLimit));
    }
  }

  anomalyScore(x) {
    if (!this.trees || this.trees.length === 0) return 0.0;
    let sum = 0;
    for (const t of this.trees) sum += pathLength(x, t, 0);
    const avg = sum / this.trees.length;
    const score = Math.pow(2, -avg / c(this.sampleSize));
    return score; // between 0 (normal) and 1 (anomalous)
  }

  toJSON() {
    return { nTrees: this.nTrees, sampleSize: this.sampleSize, trees: this.trees };
  }

  save(path) {
    fs.mkdirSync(require('path').dirname(path), { recursive: true });
    fs.writeFileSync(path, JSON.stringify(this.toJSON()));
  }

  static load(path) {
    const raw = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(raw);
    const f = new IsolationForest(obj.nTrees, obj.sampleSize);
    f.trees = obj.trees;
    return f;
  }
}

module.exports = { IsolationForest };
