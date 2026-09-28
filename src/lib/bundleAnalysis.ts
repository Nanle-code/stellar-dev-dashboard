export interface BundleStats {
  totalSize: number;
  scripts: Array<{ url: string; size: number }>;
  styles: Array<{ url: string; size: number }>;
  images: Array<{ url: string; size: number }>;
  budget: { limit: number; current: number; exceeded: boolean };
}

const BUNDLE_SIZE_BUDGET = 500 * 1024;

export function analyzeBundleSize(): BundleStats {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const scripts: Array<{ url: string; size: number }> = [];
  const styles: Array<{ url: string; size: number }> = [];
  const images: Array<{ url: string; size: number }> = [];
  let totalSize = 0;

  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    if (size === 0) return;

    totalSize += size;

    const url = resource.name;
    if (resource.initiatorType === 'script' || url.endsWith('.js')) {
      scripts.push({ url, size });
    } else if (resource.initiatorType === 'css' || url.endsWith('.css')) {
      styles.push({ url, size });
    } else if (resource.initiatorType === 'img' || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url)) {
      images.push({ url, size });
    }
  });

  scripts.sort((a, b) => b.size - a.size);
  styles.sort((a, b) => b.size - a.size);
  images.sort((a, b) => b.size - a.size);

  const exceeded = totalSize > BUNDLE_SIZE_BUDGET;

  return {
    totalSize,
    scripts: scripts.slice(0, 10),
    styles: styles.slice(0, 10),
    images: images.slice(0, 10),
    budget: {
      limit: BUNDLE_SIZE_BUDGET,
      current: totalSize,
      exceeded,
    },
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getOptimizationSuggestions(stats: BundleStats): string[] {
  const suggestions: string[] = [];

  if (stats.budget.exceeded) {
    suggestions.push(`Bundle size exceeds budget by ${formatSize(stats.budget.current - stats.budget.limit)}`);
  }

  const largeScripts = stats.scripts.filter(s => s.size > 100 * 1024);
  if (largeScripts.length > 0) {
    suggestions.push(`${largeScripts.length} JavaScript files exceed 100KB - consider code splitting`);
  }

  const largeImages = stats.images.filter(i => i.size > 200 * 1024);
  if (largeImages.length > 0) {
    suggestions.push(`${largeImages.length} images exceed 200KB - consider compression or lazy loading`);
  }

  if (stats.scripts.length > 20) {
    suggestions.push('Too many script files - consider bundling to reduce HTTP requests');
  }

  return suggestions;
}
