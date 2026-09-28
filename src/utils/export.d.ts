export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType?: string
): void;
export function exportCsv(
  rows: Record<string, unknown>[],
  filename: string,
  columns?: string[]
): void;
export function exportJson(data: unknown, filename: string): void;
export function exportPdf(text: string, filename: string): void;
export function buildBackupPayload(state: Record<string, unknown>): Record<string, unknown>;
export function flattenTransaction(tx: Record<string, unknown>): Record<string, unknown>;
export function flattenBalance(balance: Record<string, unknown>): Record<string, unknown>;
export function exportHistoricalBalances(
  history: Array<Record<string, unknown>>,
  filename?: string
): void;
