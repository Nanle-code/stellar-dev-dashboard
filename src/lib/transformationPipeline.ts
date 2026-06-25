/**
 * Data Transformation Pipeline
 * Handles data transformations, custom rules, and transformation templates
 */

import type {
  TransformationRule,
  TransformationTemplate,
} from '../types/dataExport';

/**
 * Apply a single transformation rule to data
 * @param {Object[]} data - Input data rows
 * @param {TransformationRule} rule - Rule to apply
 * @returns {Object[]} - Transformed data
 */
export function applyTransformationRule(data, rule) {
  if (!rule.enabled) return data;

  switch (rule.type) {
    case 'filter':
      return applyFilterRule(data, rule.config);
    case 'map':
      return applyMapRule(data, rule.config);
    case 'aggregate':
      return applyAggregateRule(data, rule.config);
    case 'custom':
      return applyCustomRule(data, rule.config);
    default:
      return data;
  }
}

/**
 * Apply multiple transformation rules in sequence
 * @param {Object[]} data - Input data
 * @param {TransformationRule[]} rules - Rules to apply
 * @returns {Object[]} - Transformed data
 */
export function applyTransformationPipeline(data, rules) {
  let result = data;

  // Sort rules by order
  const sortedRules = [...rules].sort((a, b) => a.order - b.order);

  for (const rule of sortedRules) {
    result = applyTransformationRule(result, rule);
  }

  return result;
}

/**
 * Filter transformation - remove rows matching criteria
 * @param {Object[]} data
 * @param {Object} config - { field: string, operator: string, value: any }
 * @returns {Object[]}
 */
function applyFilterRule(data, config) {
  const { field, operator, value } = config;

  return data.filter((row) => {
    const rowValue = row[field];

    switch (operator) {
      case 'equals':
        return rowValue === value;
      case 'notEquals':
        return rowValue !== value;
      case 'greaterThan':
        return rowValue > value;
      case 'lessThan':
        return rowValue < value;
      case 'greaterOrEqual':
        return rowValue >= value;
      case 'lessOrEqual':
        return rowValue <= value;
      case 'contains':
        return String(rowValue).includes(value);
      case 'notContains':
        return !String(rowValue).includes(value);
      case 'startsWith':
        return String(rowValue).startsWith(value);
      case 'endsWith':
        return String(rowValue).endsWith(value);
      case 'in':
        return Array.isArray(value) && value.includes(rowValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(rowValue);
      default:
        return true;
    }
  });
}

/**
 * Map transformation - add/remove/rename columns
 * @param {Object[]} data
 * @param {Object} config - { operations: Array<{type: string, field?: string, newField?: string, value?: any}> }
 * @returns {Object[]}
 */
function applyMapRule(data, config) {
  const { operations } = config;

  if (!Array.isArray(operations)) return data;

  return data.map((row) => {
    let newRow = { ...row };

    for (const op of operations) {
      switch (op.type) {
        case 'rename':
          if (op.field in newRow) {
            newRow[op.newField] = newRow[op.field];
            delete newRow[op.field];
          }
          break;
        case 'remove':
          delete newRow[op.field];
          break;
        case 'add':
          newRow[op.field] = op.value;
          break;
        case 'compute':
          // Allow simple expressions
          if (op.formula) {
            try {
              newRow[op.field] = evaluateFormula(op.formula, newRow);
            } catch (e) {
              // Keep original or skip
            }
          }
          break;
      }
    }

    return newRow;
  });
}

/**
 * Aggregate transformation - group and aggregate data
 * @param {Object[]} data
 * @param {Object} config - { groupBy: string[], aggregations: Array<{field: string, operation: string}> }
 * @returns {Object[]}
 */
function applyAggregateRule(data, config) {
  const { groupBy, aggregations } = config;

  if (!groupBy || !aggregations) return data;

  // Create groups
  const groups = new Map();

  for (const row of data) {
    const key = groupBy.map((field) => row[field]).join('|');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  // Aggregate each group
  const results = [];

  for (const [key, rows] of groups) {
    const groupKey = groupBy.map((field, i) => ({
      [field]: rows[0][field],
    }));

    const groupRow = Object.assign({}, ...groupKey);

    for (const agg of aggregations) {
      const values = rows.map((r) => parseFloat(r[agg.field]) || 0);

      switch (agg.operation) {
        case 'sum':
          groupRow[`${agg.field}_sum`] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          groupRow[`${agg.field}_avg`] =
            values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'min':
          groupRow[`${agg.field}_min`] = Math.min(...values);
          break;
        case 'max':
          groupRow[`${agg.field}_max`] = Math.max(...values);
          break;
        case 'count':
          groupRow[`${agg.field}_count`] = rows.length;
          break;
      }
    }

    results.push(groupRow);
  }

  return results;
}

/**
 * Custom transformation - apply a user-defined function
 * @param {Object[]} data
 * @param {Object} config - { functionBody: string }
 * @returns {Object[]}
 */
function applyCustomRule(data, config) {
  const { functionBody } = config;

  if (!functionBody) return data;

  try {
    // Create a safe function in an isolated scope
    const transformFn = new Function('row', functionBody);
    return data.map((row) => transformFn(row) || row);
  } catch (error) {
    console.error('Error applying custom transformation:', error);
    return data;
  }
}

/**
 * Simple formula evaluator for computed fields
 * @param {string} formula - Formula string (e.g., "{field1} + {field2}")
 * @param {Object} row - Data row
 * @returns {any}
 */
function evaluateFormula(formula, row) {
  let result = formula;

  // Replace field references
  Object.entries(row).forEach(([field, value]) => {
    result = result.replace(new RegExp(`{${field}}`, 'g'), value);
  });

  // Safe evaluation
  try {
    return Function(`"use strict"; return (${result})`)();
  } catch {
    return null;
  }
}

/**
 * Create a new transformation template
 * @param {string} name - Template name
 * @param {string} description - Template description
 * @param {TransformationRule[]} rules - Transformation rules
 * @returns {TransformationTemplate}
 */
export function createTransformationTemplate(
  name,
  description,
  rules
) {
  return {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    rules,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Predefined transformation templates
 */
export const TRANSFORMATION_TEMPLATES = {
  // Remove sensitive data
  anonymize: createTransformationTemplate(
    'Anonymize Data',
    'Remove personally identifiable information',
    [
      {
        id: 'remove_emails',
        name: 'Remove Email Addresses',
        type: 'map',
        config: {
          operations: [{ type: 'remove', field: 'email' }],
        },
        order: 1,
        enabled: true,
      },
      {
        id: 'remove_personal',
        name: 'Remove Personal Info',
        type: 'map',
        config: {
          operations: [
            { type: 'remove', field: 'phone' },
            { type: 'remove', field: 'address' },
          ],
        },
        order: 2,
        enabled: true,
      },
    ]
  ),

  // Financial summary
  financialSummary: createTransformationTemplate(
    'Financial Summary',
    'Aggregate financial data by asset',
    [
      {
        id: 'aggregate_by_asset',
        name: 'Group by Asset',
        type: 'aggregate',
        config: {
          groupBy: ['asset_code'],
          aggregations: [
            { field: 'balance', operation: 'sum' },
            { field: 'balance', operation: 'avg' },
          ],
        },
        order: 1,
        enabled: true,
      },
    ]
  ),

  // Large transactions only
  largeTransactions: createTransformationTemplate(
    'Large Transactions',
    'Filter to transactions above a threshold',
    [
      {
        id: 'filter_large',
        name: 'Amount > 1000',
        type: 'filter',
        config: {
          field: 'amount',
          operator: 'greaterThan',
          value: 1000,
        },
        order: 1,
        enabled: true,
      },
    ]
  ),

  // Date range filter
  dateRange: createTransformationTemplate(
    'Date Range Filter',
    'Filter transactions by date range',
    [
      {
        id: 'recent_transactions',
        name: 'Last 30 Days',
        type: 'filter',
        config: {
          field: 'created_at',
          operator: 'greaterOrEqual',
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        order: 1,
        enabled: true,
      },
    ]
  ),
};

/**
 * Get predefined template by name
 * @param {string} templateName - Template identifier
 * @returns {TransformationTemplate | null}
 */
export function getTransformationTemplate(templateName) {
  return TRANSFORMATION_TEMPLATES[templateName] || null;
}

/**
 * Validate transformation rule configuration
 * @param {TransformationRule} rule - Rule to validate
 * @returns {string[]} - Array of validation errors (empty if valid)
 */
export function validateTransformationRule(rule) {
  const errors = [];

  if (!rule.name) errors.push('Rule name is required');
  if (!rule.type) errors.push('Rule type is required');
  if (typeof rule.order !== 'number') errors.push('Rule order must be a number');

  switch (rule.type) {
    case 'filter':
      if (!rule.config.field) errors.push('Filter rule requires a field');
      if (!rule.config.operator) errors.push('Filter rule requires an operator');
      break;
    case 'map':
      if (!Array.isArray(rule.config.operations)) {
        errors.push('Map rule requires operations array');
      }
      break;
    case 'aggregate':
      if (!Array.isArray(rule.config.groupBy)) {
        errors.push('Aggregate rule requires groupBy array');
      }
      if (!Array.isArray(rule.config.aggregations)) {
        errors.push('Aggregate rule requires aggregations array');
      }
      break;
  }

  return errors;
}
