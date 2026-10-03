import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const INLINE_STYLE_BASELINES = {
  'src/routes/DashboardLayout.tsx': 20,
}

export function countInlineStyleObjects(source, filename = 'component.tsx') {
  const scriptKind = filename.endsWith('.tsx') || filename.endsWith('.jsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, scriptKind)
  let count = 0

  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'style') {
      const expression = node.initializer && ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : undefined
      if (expression && ts.isObjectLiteralExpression(expression)) count += 1
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  return count
}

export function meetsInlineStyleReduction(baseline, current, requiredReduction = 0.8) {
  if (baseline <= 0) return current === 0
  return (baseline - current) / baseline >= requiredReduction
}

function run() {
  let failed = false
  for (const [filename, baseline] of Object.entries(INLINE_STYLE_BASELINES)) {
    const source = fs.readFileSync(path.resolve(filename), 'utf8')
    const current = countInlineStyleObjects(source, filename)
    const reduction = baseline === 0 ? 1 : (baseline - current) / baseline
    console.log(`${filename}: ${current}/${baseline} inline style objects (${Math.round(reduction * 100)}% reduction; required 80%)`)
    if (!meetsInlineStyleReduction(baseline, current)) failed = true
  }
  if (failed) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  run()
}