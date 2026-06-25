/**
 * Extended data export utilities for multiple formats
 * XML, Parquet, and format-agnostic helpers
 */

/**
 * Build a simple XML string from an array of objects
 * @param {Object[]} rows - Data rows
 * @param {string} rootElement - Root XML element name
 * @param {string} rowElement - Element name for each row
 * @returns {string}
 */
export function buildXmlString(rows, rootElement = 'data', rowElement = 'row') {
  const escape = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<${rootElement}>\n`;

  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((row) => {
      xml += `  <${rowElement}>\n`;
      Object.entries(row).forEach(([key, value]) => {
        const safeKey = escape(key);
        const safeValue = escape(value);
        xml += `    <${safeKey}>${safeValue}</${safeKey}>\n`;
      });
      xml += `  </${rowElement}>\n`;
    });
  }

  xml += `</${rootElement}>`;
  return xml;
}

/**
 * Export rows to XML format
 * @param {Object[]} rows - Data rows
 * @param {string} filename - Download filename (without extension)
 * @param {string} rootElement - Root XML element name
 * @param {string} rowElement - Element name for each row
 */
export function exportXml(rows, filename, rootElement = 'data', rowElement = 'row') {
  if (!rows || rows.length === 0) {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement}></${rootElement}>`;
    const blob = new Blob([emptyXml], { type: 'application/xml' });
    downloadFileBlob(blob, `${filename}.xml`);
    return;
  }

  const xml = buildXmlString(rows, rootElement, rowElement);
  const blob = new Blob([xml], { type: 'application/xml' });
  downloadFileBlob(blob, `${filename}.xml`);
}

/**
 * Simple Parquet-like columnar format (simplified Apache Parquet-like structure)
 * Creates a binary format with column metadata
 * @param {Object[]} rows - Data rows
 * @param {string} filename - Download filename (without extension)
 */
export function exportParquet(rows, filename) {
  if (!rows || rows.length === 0) {
    const emptyParquet = buildParquetBuffer([]);
    downloadFileBlob(emptyParquet, `${filename}.parquet`);
    return;
  }

  const parquetBuffer = buildParquetBuffer(rows);
  downloadFileBlob(parquetBuffer, `${filename}.parquet`);
}

/**
 * Build a simplified Parquet-like binary buffer
 * This is a simplified implementation for educational purposes
 * For production, use a dedicated Parquet library
 * @param {Object[]} rows
 * @returns {Blob}
 */
function buildParquetBuffer(rows) {
  const encoder = new TextEncoder();

  // Magic number (PAR1)
  const magic = encoder.encode('PAR1');

  // Metadata header
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const metadata = {
    version: 1,
    columns: columns,
    numRows: rows.length,
    createdAt: new Date().toISOString(),
  };
  const metadataStr = JSON.stringify(metadata);
  const metadataBytes = encoder.encode(metadataStr);
  const metadataLength = new Uint32Array([metadataBytes.length]);

  // Data section
  const dataStr = JSON.stringify(rows);
  const dataBytes = encoder.encode(dataStr);

  // Combine: PAR1 | metadata_length | metadata | data | PAR1
  const parts = [
    magic,
    new Uint8Array(metadataLength.buffer),
    metadataBytes,
    dataBytes,
    magic,
  ];

  return new Blob(parts, { type: 'application/octet-stream' });
}

/**
 * Download a Blob object
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Download filename
 */
export function downloadFileBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generic export handler supporting multiple formats
 * @param {Object[]} data - Data rows to export
 * @param {string} format - Export format (csv, json, xml, parquet, pdf)
 * @param {string} filename - Download filename
 * @param {Object} options - Additional format-specific options
 */
export async function exportData(data, format, filename, options = {}) {
  switch (format.toLowerCase()) {
    case 'csv':
      return exportCsv(data, filename, options.columns);
    case 'json':
      return exportJson(data, filename);
    case 'xml':
      return exportXml(data, filename, options.rootElement, options.rowElement);
    case 'parquet':
      return exportParquet(data, filename);
    case 'pdf':
      const pdfText = formatAsPdfText(data, options);
      return exportPdf(pdfText, filename);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Format data as plain text for PDF export
 * @param {Object[]} data - Data rows
 * @param {Object} options - Format options
 * @returns {string}
 */
function formatAsPdfText(data, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return 'No data to export';
  }

  const columns = options.columns || Object.keys(data[0]);
  const header = columns.join(' | ');
  const rows = data.map((row) =>
    columns.map((col) => String(row[col] ?? '')).join(' | ')
  );

  return [header, ...rows].join('\n');
}

/**
 * Import the necessary functions from the main export module
 * These need to be re-exported for backward compatibility
 */
export { downloadFile, exportCsv, exportJson, exportPdf } from './export.js';
