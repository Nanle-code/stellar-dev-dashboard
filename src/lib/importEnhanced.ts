/**
 * Enhanced data import utilities with preview and validation
 */

import type {
  ImportPreview,
  ImportValidationError,
  ImportResult,
  ExportFormat,
} from '../types/dataExport';

/**
 * Read and parse file content based on format
 * @param {File} file - File to read
 * @param {ExportFormat} format - Expected format
 * @returns {Promise<Object>}
 */
export async function parseImportFile(file, format) {
  const content = await readFileAsText(file);

  switch (format.toLowerCase()) {
    case 'json':
      return parseJsonContent(content);
    case 'csv':
      return parseCsvContent(content);
    case 'xml':
      return parseXmlContent(content);
    case 'parquet':
      return parseParquetContent(file);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Generate import preview from file
 * @param {File} file - File to preview
 * @param {ExportFormat} format - File format
 * @param {number} sampleRows - Number of sample rows (default: 5)
 * @returns {Promise<ImportPreview>}
 */
export async function generateImportPreview(file, format, sampleRows = 5) {
  const startTime = performance.now();
  const fileSize = file.size;
  const estimatedMemory = fileSize * 2; // Rough estimate

  try {
    const data = await parseImportFile(file, format);
    const rows = Array.isArray(data) ? data : data.rows || [];

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      filename: file.name,
      format: format as ExportFormat,
      rowCount: rows.length,
      columnCount: columns.length,
      columns,
      sampleRows: rows.slice(0, sampleRows),
      fileSize,
      estimatedMemory,
    };
  } catch (error) {
    throw new Error(`Failed to generate preview: ${error.message}`);
  }
}

/**
 * Validate imported data
 * @param {Object[]} data - Data rows to validate
 * @param {Object} schema - Validation schema
 * @returns {ImportValidationError[]}
 */
export function validateImportData(data, schema = {}) {
  const errors = [];

  if (!Array.isArray(data)) {
    errors.push({
      message: 'Data must be an array of objects',
      severity: 'error',
    });
    return errors;
  }

  data.forEach((row, index) => {
    if (typeof row !== 'object' || row === null) {
      errors.push({
        row: index,
        message: 'Row must be an object',
        severity: 'error',
      });
      return;
    }

    // Validate against schema if provided
    Object.entries(schema).forEach(([field, rules]) => {
      const value = row[field];
      const validation = validateField(value, field, rules, index);
      errors.push(...validation);
    });
  });

  return errors;
}

/**
 * Validate a single field
 * @param {any} value - Field value
 * @param {string} field - Field name
 * @param {Object} rules - Validation rules
 * @param {number} rowIndex - Row index
 * @returns {ImportValidationError[]}
 */
function validateField(value, field, rules, rowIndex) {
  const errors = [];

  if (!rules) return errors;

  // Required
  if (rules.required && (value === null || value === undefined || value === '')) {
    errors.push({
      row: rowIndex,
      column: field,
      message: `${field} is required`,
      severity: 'error',
    });
  }

  // Type
  if (rules.type && value !== null && value !== undefined) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push({
        row: rowIndex,
        column: field,
        message: `${field} must be of type ${rules.type}, got ${actualType}`,
        severity: rules.optional ? 'warning' : 'error',
      });
    }
  }

  // Min length
  if (
    rules.minLength &&
    typeof value === 'string' &&
    value.length < rules.minLength
  ) {
    errors.push({
      row: rowIndex,
      column: field,
      message: `${field} must be at least ${rules.minLength} characters`,
      severity: 'error',
    });
  }

  // Max length
  if (
    rules.maxLength &&
    typeof value === 'string' &&
    value.length > rules.maxLength
  ) {
    errors.push({
      row: rowIndex,
      column: field,
      message: `${field} must be at most ${rules.maxLength} characters`,
      severity: 'error',
    });
  }

  // Min value
  if (rules.min && typeof value === 'number' && value < rules.min) {
    errors.push({
      row: rowIndex,
      column: field,
      message: `${field} must be at least ${rules.min}`,
      severity: 'error',
    });
  }

  // Max value
  if (rules.max && typeof value === 'number' && value > rules.max) {
    errors.push({
      row: rowIndex,
      column: field,
      message: `${field} must be at most ${rules.max}`,
      severity: 'error',
    });
  }

  // Pattern
  if (rules.pattern && typeof value === 'string') {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      errors.push({
        row: rowIndex,
        column: field,
        message: `${field} does not match required pattern`,
        severity: 'error',
      });
    }
  }

  // Enum
  if (rules.enum && Array.isArray(rules.enum)) {
    if (!rules.enum.includes(value)) {
      errors.push({
        row: rowIndex,
        column: field,
        message: `${field} must be one of: ${rules.enum.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Custom validator
  if (rules.validate && typeof rules.validate === 'function') {
    const isValid = rules.validate(value);
    if (!isValid) {
      errors.push({
        row: rowIndex,
        column: field,
        message: rules.customMessage || `${field} validation failed`,
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Process import with error handling
 * @param {Object[]} data - Data to import
 * @param {Object} options - Import options
 * @returns {ImportResult}
 */
export function processImport(data, options = {}) {
  const {
    schema = {},
    skipErrors = false,
    transform = null,
    limit = null,
  } = options;

  const result = {
    success: true,
    recordsProcessed: 0,
    recordsSkipped: 0,
    errors: [],
    warnings: [],
    importedAt: new Date(),
  };

  if (!Array.isArray(data)) {
    result.success = false;
    result.errors.push({
      message: 'Data must be an array',
      severity: 'error',
    });
    return result;
  }

  let processedCount = 0;

  for (let i = 0; i < data.length; i++) {
    if (limit && processedCount >= limit) {
      result.recordsSkipped += data.length - i;
      break;
    }

    const row = data[i];

    // Validate row
    const rowErrors = validateField(row, `row_${i}`, schema);

    if (rowErrors.length > 0) {
      result.errors.push(...rowErrors);

      if (!skipErrors) {
        result.success = false;
        break;
      }

      result.recordsSkipped++;
      continue;
    }

    // Transform if needed
    let processedRow = row;
    if (transform && typeof transform === 'function') {
      try {
        processedRow = transform(row);
      } catch (error) {
        result.warnings.push({
          row: i,
          message: `Failed to transform row: ${error.message}`,
          severity: 'warning',
        });
      }
    }

    result.recordsProcessed++;
    processedCount++;
  }

  return result;
}

/**
 * File reading utilities
 */

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format-specific parsers
 */

function parseJsonContent(content) {
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function parseCsvContent(content) {
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseXmlContent(content) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');

  if (xmlDoc.parseError) {
    throw new Error('Invalid XML');
  }

  const rows = [];
  const elements = xmlDoc.documentElement.children;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const row = {};

    for (let j = 0; j < element.children.length; j++) {
      const child = element.children[j];
      row[child.tagName] = child.textContent;
    }

    rows.push(row);
  }

  return rows;
}

async function parseParquetContent(file) {
  // Simplified Parquet parser for the format created by exportExtended.js
  const buffer = await readFileAsArrayBuffer(file);
  const view = new Uint8Array(buffer);

  // Check magic number
  if (
    view[0] !== 80 || // P
    view[1] !== 65 || // A
    view[2] !== 82 || // R
    view[3] !== 49 // 1
  ) {
    throw new Error('Invalid Parquet file');
  }

  // Find metadata length (after magic, first 4 bytes)
  const metadataLength = new DataView(buffer).getUint32(4, true);

  // Read metadata
  const metadataStart = 8;
  const metadataEnd = metadataStart + metadataLength;
  const metadataBytes = view.slice(metadataStart, metadataEnd);
  const metadataStr = new TextDecoder().decode(metadataBytes);
  const metadata = JSON.parse(metadataStr);

  // Read data
  const dataStart = metadataEnd;
  const dataEnd = buffer.byteLength - 4; // Exclude trailing PAR1
  const dataBytes = view.slice(dataStart, dataEnd);
  const dataStr = new TextDecoder().decode(dataBytes);
  const data = JSON.parse(dataStr);

  return data;
}

/**
 * Import size validator
 */
export function validateImportSize(file, maxSizeMB = 100) {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxBytes) {
    return {
      valid: false,
      message: `File exceeds maximum size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Batch import processor for large files
 */
export async function* batchImportProcessor(
  file,
  format,
  batchSize = 1000
) {
  const data = await parseImportFile(file, format);

  for (let i = 0; i < data.length; i += batchSize) {
    yield {
      batch: Math.floor(i / batchSize),
      data: data.slice(i, i + batchSize),
      total: data.length,
      progress: Math.round((i / data.length) * 100),
    };
  }
}
