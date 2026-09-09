/**
 * Data export utilities (#114).
 *
 * Converts dashboard data (account info, transactions, assets, settings)
 * to JSON or CSV and triggers a browser download.
 */

/**
 * Trigger a file download in the browser.
 * @param {string} content  - File contents as a string
 * @param {string} filename - Suggested filename
 * @param {string} mimeType - MIME type (default: application/json)
 */
export function downloadFile(content, filename, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export an array of objects to a CSV file.
 * @param {Object[]} rows       - Data rows
 * @param {string}   filename   - Download filename (without extension)
 * @param {string[]} [columns]  - Column names; inferred from first row if omitted
 */
export function exportCsv(rows, filename, columns) {
  if (!rows || rows.length === 0) {
    downloadFile("", `${filename}.csv`, "text/csv");
    return;
  }
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    cols.join(","),
    ...rows.map((row) => cols.map((c) => escape(row[c])).join(",")),
  ];
  downloadFile(lines.join("\r\n"), `${filename}.csv`, "text/csv");
}

/**
 * Export any value to a JSON file.
 * @param {*}      data     - Data to serialise
 * @param {string} filename - Download filename (without extension)
 */
export function exportJson(data, filename) {
  downloadFile(JSON.stringify(data, null, 2), `${filename}.json`);
}

function escapePdfString(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
}

function buildPdfBlob(text) {
  const lines = String(text).split('\n');
  const contentStream = [
    'BT',
    '/F1 10 Tf',
    '50 760 Td',
    ...lines.map((line, index) => {
      const safeLine = escapePdfString(line);
      return index === 0 ? `(${safeLine}) Tj` : `T* (${safeLine}) Tj`;
    }),
    'ET'
  ].join('\n');

  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(contentStream);
  const streamLength = streamBytes.length;

  const components = [
    '%PDF-1.1\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  let offset = 0;
  const offsets = [offset];
  for (const part of components) {
    offset += encoder.encode(part).length;
    offsets.push(offset);
  }

  const xrefOffset = offset;
  const xrefEntries = ['xref\n0 6\n0000000000 65535 f \n'];
  for (let i = 1; i <= 5; i += 1) {
    xrefEntries.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([...components, xrefEntries.join(''), trailer], { type: 'application/pdf' });
}

export function exportPdf(text, filename) {
  const blob = buildPdfBlob(text);
  downloadFile(blob, `${filename}.pdf`, 'application/pdf');
}

/**
 * Build the complete dashboard backup object from live state.
 * @param {Object} state - Zustand store state snapshot
 * @returns {Object}     - Backup payload
 */
export function buildBackupPayload(state) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      connectedAddress: state.connectedAddress ?? null,
      network: state.network ?? "testnet",
    },
    watchedAddresses: state.watchedAddresses ?? [],
    customNetworks: state.customNetworks ?? [],
    theme: state.theme ?? "dark",
    activeTab: state.activeTab ?? "overview",
  };
}

/**
 * Flatten a Horizon transaction record to a plain CSV row.
 * @param {Object} tx - Horizon transaction record
 * @returns {Object}
 */
export function flattenTransaction(tx) {
  return {
    id: tx.id,
    hash: tx.hash,
    ledger: tx.ledger,
    created_at: tx.created_at,
    source_account: tx.source_account,
    fee_charged: tx.fee_charged,
    operation_count: tx.operation_count,
    successful: tx.successful,
    memo_type: tx.memo_type ?? "",
    memo: tx.memo ?? "",
  };
}

/**
 * Flatten a Horizon balance object (from account.balances) to a CSV row.
 * @param {Object} balance - Horizon balance record
 * @returns {Object}
 */
export function flattenBalance(balance) {
  return {
    asset_type: balance.asset_type,
    asset_code: balance.asset_code ?? "XLM",
    asset_issuer: balance.asset_issuer ?? "",
    balance: balance.balance,
    limit: balance.limit ?? "",
    buying_liabilities: balance.buying_liabilities ?? "0",
    selling_liabilities: balance.selling_liabilities ?? "0",
  };
}

/**
 * Export historical running balances to CSV.
 * Format: Timestamp, Balance, Asset
 * @param {Array} history - Reconstructed history snapshot array
 * @param {string} filename
 */
export function exportHistoricalBalances(history, filename = "portfolio-history") {
  const rows = [];
  history.forEach((snapshot) => {
    const timestamp = new Date(snapshot.timestamp).toISOString();
    Object.entries(snapshot.balances).forEach(([asset, balance]) => {
      rows.push({
        Timestamp: timestamp,
        Balance: balance,
        Asset: asset,
      });
    });
  });
  exportCsv(rows, filename, ["Timestamp", "Balance", "Asset"]);
}
