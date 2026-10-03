/**
 * WASM Size Analysis and Optimization Tips
 * 
 * #852 - Add Wasm size and optimization tips in upload flow
 * Provides warnings when Wasm approaches network limits and optimization guidance
 */

export const MAX_WASM_BYTES = 20 * 1024 * 1024; // 20 MB Stellar network limit
export const WARNING_THRESHOLD = 0.8; // Warn at 80% of limit
export const CRITICAL_THRESHOLD = 0.95; // Critical warning at 95% of limit

export interface WasmSizeAnalysis {
  sizeBytes: number;
  sizeKb: number;
  sizeMb: number;
  percentageOfLimit: number;
  severity: 'safe' | 'warning' | 'critical' | 'exceeded';
  warnings: string[];
  optimizationTips: OptimizationTip[];
}

export interface OptimizationTip {
  category: 'general' | 'rust' | 'assemblyscript' | 'c++' | 'build';
  title: string;
  description: string;
  command?: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Analyze WASM file size and provide warnings/optimization tips
 */
export function analyzeWasmSize(sizeBytes: number): WasmSizeAnalysis {
  const sizeKb = sizeBytes / 1024;
  const sizeMb = sizeBytes / (1024 * 1024);
  const percentageOfLimit = (sizeBytes / MAX_WASM_BYTES) * 100;

  let severity: 'safe' | 'warning' | 'critical' | 'exceeded';
  const warnings: string[] = [];

  if (sizeBytes > MAX_WASM_BYTES) {
    severity = 'exceeded';
    warnings.push(`WASM file exceeds network limit of ${MAX_WASM_BYTES / (1024 * 1024)} MB`);
  } else if (percentageOfLimit >= CRITICAL_THRESHOLD * 100) {
    severity = 'critical';
    warnings.push(
      `WASM file is at ${percentageOfLimit.toFixed(1)}% of network limit. Strongly recommend optimization before deployment.`
    );
  } else if (percentageOfLimit >= WARNING_THRESHOLD * 100) {
    severity = 'warning';
    warnings.push(
      `WASM file is at ${percentageOfLimit.toFixed(1)}% of network limit. Consider optimization for better performance.`
    );
  } else {
    severity = 'safe';
  }

  // Add contextual warnings based on size
  if (sizeMb > 5) {
    warnings.push('Large WASM files may have higher deployment costs and slower load times.');
  }
  if (sizeMb > 10) {
    warnings.push('Very large WASM files may approach transaction size limits on some networks.');
  }

  const optimizationTips = generateOptimizationTips(sizeBytes);

  return {
    sizeBytes,
    sizeKb,
    sizeMb,
    percentageOfLimit,
    severity,
    warnings,
    optimizationTips,
  };
}

/**
 * Generate optimization tips based on file size and common patterns
 */
function generateOptimizationTips(sizeBytes: number): OptimizationTip[] {
  const tips: OptimizationTip[] = [];

  // General tips
  tips.push({
    category: 'general',
    title: 'Remove Debug Symbols',
    description:
      'Strip debug symbols and build artifacts to reduce size significantly. Debug information can add 30-50% to file size.',
    command: 'wasm-opt --strip-debug input.wasm -o output.wasm',
    impact: 'high',
  });

  tips.push({
    category: 'general',
    title: 'Enable LTO (Link Time Optimization)',
    description:
      'Link-time optimization allows the compiler to optimize across compilation units, reducing code size.',
    command: '--release-lto for Rust projects',
    impact: 'high',
  });

  tips.push({
    category: 'general',
    title: 'Use wasm-opt Optimizations',
    description:
      'Binaryen wasm-opt provides multiple optimization passes that can significantly reduce WASM size.',
    command: 'wasm-opt -O3 -Os input.wasm -o output.wasm',
    impact: 'high',
  });

  // Rust-specific tips
  tips.push({
    category: 'rust',
    title: 'Optimize Rust Build Profile',
    description:
      'Use release profile with size optimizations. Add lto=true and codegen-units=1 to Cargo.toml.',
    command: '[profile.release]\nopt-level = "z"\nlto = true\ncodegen-units = 1',
    impact: 'high',
  });

  tips.push({
    category: 'rust',
    title: 'Use Default Features Sparingly',
    description:
      'Disable unused default features in dependencies. Use default-features=false and enable only what you need.',
    command: 'my-dependency = { version = "1.0", default-features = false, features = ["needed-feature"] }',
    impact: 'medium',
  });

  tips.push({
    category: 'rust',
    title: 'Replace Heavy Dependencies',
    description:
      'Consider using lighter alternatives for common operations. For example, use serde-json-core instead of full serde.',
    command: 'Search for "no_std" alternatives on crates.io',
    impact: 'medium',
  });

  tips.push({
    category: 'rust',
    title: 'Use alloc instead of std',
    description:
      'When possible, use the alloc crate instead of std to avoid including unnecessary runtime components.',
    command: '#![no_std]\nextern crate alloc;',
    impact: 'medium',
  });

  // AssemblyScript tips
  tips.push({
    category: 'assemblyscript',
    title: 'Enable AssemblyScript Optimizations',
    description:
      'Use --optimize flag during compilation and enable specific optimization passes in asconfig.json.',
    command: 'asc assembly/index.ts --optimize --outFile build/release.wasm',
    impact: 'high',
  });

  tips.push({
    category: 'assemblyscript',
    title: 'Use --noAssert Flag',
    description:
      'Disable runtime assertions in production builds. This can reduce size significantly but removes safety checks.',
    command: 'asc assembly/index.ts --noAssert --optimize',
    impact: 'medium',
  });

  // C++ tips
  tips.push({
    category: 'c++',
    title: 'Optimize Emscripten Build',
    description:
      'Use -O3 optimization level and enable LTO. Consider using -Os for size-optimized builds.',
    command: 'emcc -O3 -flto --closure 1 -s WASM=1 input.cpp -o output.wasm',
    impact: 'high',
  });

  tips.push({
    category: 'c++',
    title: 'Use Closure Compiler',
    description:
      'Emscripten can use Closure Compiler to minify JavaScript glue code, reducing overall bundle size.',
    command: 'emcc --closure 1 input.cpp -o output.js',
    impact: 'medium',
  });

  // Build tips
  tips.push({
    category: 'build',
    title: 'Minimize Exported Functions',
    description:
      'Only export functions that are actually needed by your contract. Each exported function adds overhead.',
    command: '#[no_mangle] pub extern "C" fn only_needed_function() { ... }',
    impact: 'medium',
  });

  tips.push({
    category: 'build',
    title: 'Use wasm-snip for Dead Code',
    description:
      'Remove unused exports and functions from WASM binaries that are not reachable from the entry points.',
    command: 'wasm-snip input.wasm -o output.wasm',
    impact: 'medium',
  });

  tips.push({
    category: 'build',
    title: 'Compress with wasm-gc',
    description:
      'Remove garbage (unreachable) code sections from the WASM binary after compilation.',
    command: 'wasm-gc input.wasm -o output.wasm',
    impact: 'medium',
  });

  // Size-specific tips
  if (sizeBytes > 10 * 1024 * 1024) {
    // > 10 MB
    tips.push({
      category: 'general',
      title: 'Consider Contract Splitting',
      description:
        'Very large contracts may benefit from being split into multiple smaller contracts that call each other.',
      impact: 'high',
    });
  }

  if (sizeBytes > 5 * 1024 * 1024) {
    // > 5 MB
    tips.push({
      category: 'general',
      title: 'Review Large Data Structures',
      description:
        'Check for large static data structures, lookup tables, or embedded assets that could be stored off-chain.',
      impact: 'high',
    });
  }

  return tips;
}

/**
 * Format size for display with appropriate units
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: 'safe' | 'warning' | 'critical' | 'exceeded'): string {
  switch (severity) {
    case 'safe':
      return '#22c55e'; // green
    case 'warning':
      return '#f59e0b'; // amber
    case 'critical':
      return '#ef4444'; // red
    case 'exceeded':
      return '#dc2626'; // dark red
  }
}

/**
 * Get icon for severity level
 */
export function getSeverityIcon(severity: 'safe' | 'warning' | 'critical' | 'exceeded'): string {
  switch (severity) {
    case 'safe':
      return '✓';
    case 'warning':
      return '⚠';
    case 'critical':
      return '🔴';
    case 'exceeded':
      return '🚫';
  }
}
