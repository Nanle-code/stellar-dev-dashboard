import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { IsolationForest } = require('./isolation_forest.cjs')
export { IsolationForest }
