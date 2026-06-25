import { OPERATION_LABELS } from './stellar'

// ─── Operators ─────────────────────────────────────────────────────────────────

const OPERATORS = {
  eq:        (a, b) => a === b,
  neq:       (a, b) => a !== b,
  gt:        (a, b) => a != null && b != null && Number(a) > Number(b),
  gte:       (a, b) => a != null && b != null && Number(a) >= Number(b),
  lt:        (a, b) => a != null && b != null && Number(a) < Number(b),
  lte:       (a, b) => a != null && b != null && Number(a) <= Number(b),
  between:   (a, b) => {
    if (a == null || !b || typeof b !== 'object') return false
    const { min, max } = b
    const val = Number(a)
    return (min == null || val >= Number(min)) && (max == null || val <= Number(max))
  },
  in:        (a, b) => Array.isArray(b) && b.includes(a),
  contains:  (a, b) => a != null && String(a).includes(String(b)),
  icontains: (a, b) => a != null && String(a).toLowerCase().includes(String(b).toLowerCase()),
  exists:    (a)    => a !== undefined && a !== null && a !== '',
  regex:     (a, b) => a != null && new RegExp(String(b)).test(String(a)),
  startsWith: (a, b) => a != null && String(a).startsWith(String(b)),
  endsWith:  (a, b) => a != null && String(a).endsWith(String(b)),
}

// ─── FilterRegistry ────────────────────────────────────────────────────────────

class FilterRegistry {
  constructor() {
    this._defs = new Map()
  }

  register(def) {
    if (this._defs.has(def.key)) {
      throw new Error(`Filter "${def.key}" is already registered`)
    }
    this._defs.set(def.key, { ...def })
  }

  registerMany(defs) {
    defs.forEach((def) => this.register(def))
  }

  get(key) {
    return this._defs.get(key)
  }

  getAll() {
    return Array.from(this._defs.values())
  }

  getByScope(scope) {
    return this.getAll().filter((d) => d.scope === scope || d.scope === 'both')
  }

  keys() {
    return Array.from(this._defs.keys())
  }
}

export const registry = new FilterRegistry()

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toBool(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  return Boolean(v)
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function safeStr(v) {
  return v != null ? String(v) : ''
}

// ─── Transaction filter definitions ────────────────────────────────────────────

registry.registerMany([
  {
    key: 'tx.hash',
    label: 'Transaction Hash',
    shortLabel: 'Hash',
    scope: 'transaction',
    type: 'string',
    operators: ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'regex'],
    defaultOperator: 'contains',
    placeholder: 'Enter transaction hash',
    extract: (tx) => tx.hash,
  },
  {
    key: 'tx.status',
    label: 'Status',
    shortLabel: 'Status',
    scope: 'transaction',
    type: 'select',
    operators: ['eq'],
    defaultOperator: 'eq',
    options: [
      { value: 'success', label: 'Successful' },
      { value: 'failed', label: 'Failed' },
    ],
    extract: (tx) => (tx.successful ? 'success' : 'failed'),
  },
  {
    key: 'tx.memo',
    label: 'Memo',
    shortLabel: 'Memo',
    scope: 'transaction',
    type: 'string',
    operators: ['icontains', 'eq', 'exists', 'regex', 'startsWith'],
    defaultOperator: 'icontains',
    placeholder: 'Search memo text',
    extract: (tx) => tx.memo || '',
  },
  {
    key: 'tx.memoType',
    label: 'Memo Type',
    shortLabel: 'Memo Type',
    scope: 'transaction',
    type: 'select',
    operators: ['eq', 'neq', 'in'],
    defaultOperator: 'eq',
    options: [
      { value: 'none', label: 'None' },
      { value: 'MEMO_TEXT', label: 'Text' },
      { value: 'MEMO_ID', label: 'ID' },
      { value: 'MEMO_HASH', label: 'Hash' },
      { value: 'MEMO_RETURN', label: 'Return' },
    ],
    extract: (tx) => tx.memo_type || 'none',
  },
  {
    key: 'tx.feeCharged',
    label: 'Fee Charged (stroops)',
    shortLabel: 'Fee',
    scope: 'transaction',
    type: 'number',
    operators: ['gte', 'lte', 'between', 'eq', 'gt', 'lt'],
    defaultOperator: 'lte',
    placeholder: 'Fee in stroops',
    extract: (tx) => toNum(tx.fee_charged),
  },
  {
    key: 'tx.maxFee',
    label: 'Max Fee (stroops)',
    shortLabel: 'Max Fee',
    scope: 'transaction',
    type: 'number',
    operators: ['gte', 'lte', 'between', 'eq', 'gt', 'lt'],
    defaultOperator: 'gte',
    placeholder: 'Max fee in stroops',
    extract: (tx) => toNum(tx.max_fee),
  },
  {
    key: 'tx.operationCount',
    label: 'Operation Count',
    shortLabel: 'Ops',
    scope: 'transaction',
    type: 'number',
    operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
    defaultOperator: 'gte',
    placeholder: 'Number of operations',
    extract: (tx) => toNum(tx.operation_count),
  },
  {
    key: 'tx.timestamp',
    label: 'Date/Time',
    shortLabel: 'Date',
    scope: 'both',
    type: 'date',
    operators: ['gte', 'lte', 'between', 'gt', 'lt', 'eq'],
    defaultOperator: 'between',
    extract: (tx) => (tx.created_at ? new Date(tx.created_at).getTime() : null),
  },
  {
    key: 'tx.ledger',
    label: 'Ledger Sequence',
    shortLabel: 'Ledger',
    scope: 'transaction',
    type: 'number',
    operators: ['eq', 'gte', 'lte', 'between', 'gt', 'lt'],
    defaultOperator: 'eq',
    placeholder: 'Ledger sequence number',
    extract: (tx) => toNum(tx.ledger),
  },
  {
    key: 'tx.sourceAccount',
    label: 'Source Account',
    shortLabel: 'Source',
    scope: 'transaction',
    type: 'string',
    operators: ['eq', 'startsWith', 'contains', 'icontains'],
    defaultOperator: 'eq',
    placeholder: 'G-prefixed public key',
    extract: (tx) => tx.source_account || '',
  },
  {
    key: 'tx.hasContract',
    label: 'Has Contract Call',
    shortLabel: 'Contract',
    scope: 'transaction',
    type: 'boolean',
    operators: ['eq'],
    defaultOperator: 'eq',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ],
    extract: (tx) => {
      const ops = tx.operations || []
      return ops.some((op) => op.type === 'invoke_host_function')
    },
  },
])

// ─── Operation filter definitions ──────────────────────────────────────────────

const OPERATION_TYPE_OPTIONS = Object.entries(OPERATION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

registry.registerMany([
  {
    key: 'op.type',
    label: 'Operation Type',
    shortLabel: 'Op Type',
    scope: 'operation',
    type: 'select',
    operators: ['eq', 'neq', 'in'],
    defaultOperator: 'eq',
    options: OPERATION_TYPE_OPTIONS,
    extract: (op) => op.type,
  },
  {
    key: 'op.sourceAccount',
    label: 'Operation Source Account',
    shortLabel: 'Op Source',
    scope: 'operation',
    type: 'string',
    operators: ['eq', 'startsWith', 'contains', 'icontains'],
    defaultOperator: 'eq',
    placeholder: 'G-prefixed public key',
    extract: (op) => op.source_account || '',
  },
  {
    key: 'op.destination',
    label: 'Destination Account',
    shortLabel: 'Destination',
    scope: 'operation',
    type: 'string',
    operators: ['eq', 'startsWith', 'contains', 'icontains'],
    defaultOperator: 'eq',
    placeholder: 'G-prefixed public key',
    extract: (op) => op.to || op.into || op.destination || '',
  },
  {
    key: 'op.amount',
    label: 'Amount (XLM)',
    shortLabel: 'Amount',
    scope: 'operation',
    type: 'number',
    operators: ['gte', 'lte', 'between', 'eq', 'gt', 'lt'],
    defaultOperator: 'gte',
    placeholder: 'Amount in XLM',
    extract: (op) => toNum(op.amount),
  },
  {
    key: 'op.assetType',
    label: 'Asset Type',
    shortLabel: 'Asset Type',
    scope: 'operation',
    type: 'select',
    operators: ['eq', 'neq'],
    defaultOperator: 'eq',
    options: [
      { value: 'native', label: 'XLM (Native)' },
      { value: 'credit_alphanum4', label: 'Alphanumeric 4' },
      { value: 'credit_alphanum12', label: 'Alphanumeric 12' },
    ],
    extract: (op) => op.asset_type || 'native',
  },
  {
    key: 'op.assetCode',
    label: 'Asset Code',
    shortLabel: 'Asset',
    scope: 'operation',
    type: 'string',
    operators: ['eq', 'icontains', 'in', 'startsWith'],
    defaultOperator: 'eq',
    placeholder: 'e.g. USDC, XLM',
    extract: (op) => op.asset_code || (op.asset_type === 'native' ? 'XLM' : ''),
  },
  {
    key: 'op.assetIssuer',
    label: 'Asset Issuer',
    shortLabel: 'Issuer',
    scope: 'operation',
    type: 'string',
    operators: ['eq', 'startsWith', 'contains'],
    defaultOperator: 'eq',
    placeholder: 'G-prefixed issuer address',
    extract: (op) => op.asset_issuer || '',
  },
  {
    key: 'op.account',
    label: 'Account (any role)',
    shortLabel: 'Account',
    scope: 'operation',
    type: 'string',
    operators: ['eq', 'startsWith', 'contains'],
    defaultOperator: 'eq',
    placeholder: 'G-prefixed public key',
    extract: (op) => op.account || op.from || op.funder || op.seller || op.buyer || '',
  },
])

// ─── Core functions ────────────────────────────────────────────────────────────

export function getDefinition(key) {
  return registry.get(key)
}

export function getFilterByScope(scope) {
  return registry.getByScope(scope)
}

export function getAllFilters() {
  return registry.getAll()
}

export function getOperatorLabel(op) {
  const labels = {
    eq: '=',
    neq: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    between: 'between',
    in: 'in',
    contains: 'contains',
    icontains: 'contains',
    exists: 'exists',
    regex: 'matches',
    startsWith: 'starts with',
    endsWith: 'ends with',
  }
  return labels[op] || op
}

export function getOperatorsForType(type) {
  const map = {
    string: ['eq', 'neq', 'contains', 'icontains', 'startsWith', 'endsWith', 'regex', 'exists'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
    boolean: ['eq'],
    date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
    select: ['eq', 'neq', 'in'],
    multiSelect: ['in', 'exists'],
    address: ['eq', 'startsWith', 'contains', 'icontains'],
    asset: ['eq', 'icontains', 'in'],
  }
  return map[type] || ['eq']
}

export function evaluateExpression(record, expr) {
  const def = registry.get(expr.key)
  if (!def) return true

  const recordValue = def.extract(record)
  const operatorFn = OPERATORS[expr.operator || def.defaultOperator]
  if (!operatorFn) return true

  const result = operatorFn(recordValue, expr.value)
  return expr.not ? !result : result
}

export function evaluateExpressions(record, expressions) {
  if (!expressions || expressions.length === 0) return true
  return expressions.every((expr) => evaluateExpression(record, expr))
}

export function filterRecords(records, expressions) {
  if (!expressions || expressions.length === 0) return records
  if (!records || records.length === 0) return records
  return records.filter((r) => evaluateExpressions(r, expressions))
}

export function countActiveFilters(expressions) {
  if (!expressions) return 0
  return expressions.filter((e) => {
    if (e == null) return false
    if (e.value === '' || e.value === undefined || e.value === null) return false
    if (Array.isArray(e.value) && e.value.length === 0) return false
    if (typeof e.value === 'object' && !Array.isArray(e.value) && e.value.min == null && e.value.max == null) return false
    return true
  }).length
}

export function expressionToSummary(expr) {
  const def = registry.get(expr.key)
  if (!def) return `${expr.key} ${expr.operator} ${expr.value}`

  const label = def.shortLabel || def.label
  const opLabel = getOperatorLabel(expr.operator || def.defaultOperator)
  let valueLabel = expr.value

  if (def.type === 'select' && def.options) {
    const opt = def.options.find((o) => o.value === expr.value)
    if (opt) valueLabel = opt.label
  }
  if (Array.isArray(valueLabel)) {
    valueLabel = valueLabel.join(', ')
  }
  if (typeof valueLabel === 'object') {
    const parts = []
    if (valueLabel.min != null) parts.push(`≥${valueLabel.min}`)
    if (valueLabel.max != null) parts.push(`≤${valueLabel.max}`)
    valueLabel = parts.join(' & ')
  }
  if (typeof valueLabel === 'boolean') {
    valueLabel = valueLabel ? 'Yes' : 'No'
  }

  const prefix = expr.not ? 'not ' : ''
  return `${prefix}${label} ${opLabel} ${valueLabel}`
}

export function expressionsToSummary(expressions) {
  if (!expressions || expressions.length === 0) return 'No filters'
  return expressions.map(expressionToSummary).join(', ')
}

// ─── Backward compat helpers ───────────────────────────────────────────────────

export function expressionsToLegacyFilters(expressions) {
  const legacy = {
    status: 'all',
    memoOnly: false,
    minFee: '',
    maxFee: '',
    type: 'all',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  }

  if (!expressions) return legacy

  expressions.forEach((expr) => {
    if (expr.key === 'tx.status') {
      legacy.status = expr.value === 'failed' ? 'failed' : expr.value === 'success' ? 'success' : 'all'
    }
    if (expr.key === 'tx.memo' && expr.operator === 'exists') {
      legacy.memoOnly = true
    }
    if (expr.key === 'tx.feeCharged') {
      if (expr.operator === 'lte' && expr.value) legacy.maxFee = String(expr.value)
      if (expr.operator === 'gte' && expr.value) legacy.minFee = String(expr.value)
      if (expr.operator === 'between' && expr.value) {
        if (expr.value.min != null) legacy.minFee = String(expr.value.min)
        if (expr.value.max != null) legacy.maxFee = String(expr.value.max)
      }
    }
    if (expr.key === 'op.type') {
      legacy.type = expr.value || 'all'
    }
    if (expr.key === 'op.amount') {
      if (expr.operator === 'lte' && expr.value) legacy.maxAmount = String(expr.value)
      if (expr.operator === 'gte' && expr.value) legacy.minAmount = String(expr.value)
      if (expr.operator === 'between' && expr.value) {
        if (expr.value.min != null) legacy.minAmount = String(expr.value.min)
        if (expr.value.max != null) legacy.maxAmount = String(expr.value.max)
      }
    }
    if (expr.key === 'tx.timestamp') {
      if (expr.operator === 'gte' && expr.value) legacy.startDate = new Date(expr.value).toISOString().split('T')[0]
      if (expr.operator === 'lte' && expr.value) legacy.endDate = new Date(expr.value).toISOString().split('T')[0]
      if (expr.operator === 'between' && expr.value) {
        if (expr.value.start) legacy.startDate = new Date(expr.value.start).toISOString().split('T')[0]
        if (expr.value.end) legacy.endDate = new Date(expr.value.end).toISOString().split('T')[0]
      }
    }
  })

  return legacy
}

export function legacyFiltersToExpressions(filters) {
  const exprs = []

  if (filters.status && filters.status !== 'all') {
    exprs.push({ key: 'tx.status', operator: 'eq', value: filters.status })
  }
  if (filters.memoOnly) {
    exprs.push({ key: 'tx.memo', operator: 'exists', value: true })
  }
  if (filters.minFee || filters.maxFee) {
    const val = {}
    if (filters.minFee) val.min = Number(filters.minFee)
    if (filters.maxFee) val.max = Number(filters.maxFee)
    if (val.min != null && val.max != null) {
      exprs.push({ key: 'tx.feeCharged', operator: 'between', value: val })
    } else if (val.min != null) {
      exprs.push({ key: 'tx.feeCharged', operator: 'gte', value: val.min })
    } else {
      exprs.push({ key: 'tx.feeCharged', operator: 'lte', value: val.max })
    }
  }
  if (filters.type && filters.type !== 'all') {
    exprs.push({ key: 'op.type', operator: 'eq', value: filters.type })
  }
  if (filters.minAmount || filters.maxAmount) {
    const val = {}
    if (filters.minAmount) val.min = Number(filters.minAmount)
    if (filters.maxAmount) val.max = Number(filters.maxAmount)
    if (val.min != null && val.max != null) {
      exprs.push({ key: 'op.amount', operator: 'between', value: val })
    } else if (val.min != null) {
      exprs.push({ key: 'op.amount', operator: 'gte', value: val.min })
    } else {
      exprs.push({ key: 'op.amount', operator: 'lte', value: val.max })
    }
  }
  if (filters.startDate || filters.endDate) {
    const val = {}
    if (filters.startDate) val.start = new Date(filters.startDate).getTime()
    if (filters.endDate) val.end = new Date(filters.endDate + 'T23:59:59.999').getTime()
    if (val.start != null && val.end != null) {
      exprs.push({ key: 'tx.timestamp', operator: 'between', value: val })
    } else if (val.start != null) {
      exprs.push({ key: 'tx.timestamp', operator: 'gte', value: val.start })
    } else {
      exprs.push({ key: 'tx.timestamp', operator: 'lte', value: val.end })
    }
  }

  return exprs
}

export default {
  registry,
  evaluateExpression,
  evaluateExpressions,
  filterRecords,
  countActiveFilters,
  expressionToSummary,
  expressionsToSummary,
  getDefinition,
  getFilterByScope,
  getAllFilters,
  getOperatorLabel,
  getOperatorsForType,
  expressionsToLegacyFilters,
  legacyFiltersToExpressions,
}
