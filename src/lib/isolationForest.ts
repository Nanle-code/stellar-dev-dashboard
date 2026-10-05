/** Browser-safe Isolation Forest used by client-side prediction helpers. */
export class IsolationForest {
  private trees: Array<{ leaf: boolean; size: number; dimension?: number; split?: number; left?: any; right?: any }> = [];

  constructor(
    private readonly treeCount = 50,
    private readonly sampleSize = 256,
  ) {}

  fit(data: number[][]): void {
    if (!data.length || !data[0]?.length) {
      this.trees = [];
      return;
    }
    const heightLimit = Math.ceil(Math.log2(Math.max(2, this.sampleSize)));
    this.trees = Array.from({ length: this.treeCount }, () => {
      const sample = data.length <= this.sampleSize
        ? data
        : [...data].sort(() => Math.random() - 0.5).slice(0, this.sampleSize);
      return this.buildTree(sample, heightLimit);
    });
  }

  score(features: number[]): number {
    if (!this.trees.length) return 0;
    const averagePath = this.trees.reduce((sum, tree) => sum + this.pathLength(features, tree), 0) / this.trees.length;
    const size = Math.min(this.sampleSize, 256);
    const normalization = size > 2
      ? 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1)) / size
      : size === 2 ? 1 : 0;
    return normalization === 0 ? 0 : Math.pow(2, -averagePath / normalization);
  }

  anomalyScore(features: number[]): number {
    return this.score(features);
  }

  private buildTree(data: number[][], heightLimit: number): { leaf: boolean; size: number; dimension?: number; split?: number; left?: any; right?: any } {
    if (data.length <= 1 || heightLimit <= 0) return { leaf: true, size: data.length };
    const dimension = Math.floor(Math.random() * data[0].length);
    const values = data.map((row) => row[dimension]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return { leaf: true, size: data.length };
    const split = min + Math.random() * (max - min);
    const left = data.filter((row) => row[dimension] < split);
    const right = data.filter((row) => row[dimension] >= split);
    return {
      leaf: false,
      size: data.length,
      dimension,
      split,
      left: this.buildTree(left, heightLimit - 1),
      right: this.buildTree(right, heightLimit - 1),
    };
  }

  private pathLength(features: number[], tree: { leaf: boolean; size: number; dimension?: number; split?: number; left?: any; right?: any }, depth = 0): number {
    if (tree.leaf) return depth + this.averagePathLength(tree.size);
    return features[tree.dimension!] < tree.split!
      ? this.pathLength(features, tree.left!, depth + 1)
      : this.pathLength(features, tree.right!, depth + 1);
  }

  private averagePathLength(size: number): number {
    if (size <= 1) return 0;
    return 2 * (Math.log(size - 1) + 0.5772156649 + 1 / (2 * (size - 1))) - 2 * (size - 1) / size;
  }
}