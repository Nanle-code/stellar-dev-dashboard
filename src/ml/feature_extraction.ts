import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { extractFeatures } = require('./feature_extraction.cjs')
export { extractFeatures }
