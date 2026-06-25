/**
 * Data Export/Import system types
 */

export type ExportFormat = 'csv' | 'json' | 'xml' | 'parquet' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  includeMetadata?: boolean;
  compression?: boolean;
  customFields?: string[];
}

export interface ExportJob {
  id: string;
  name: string;
  format: ExportFormat;
  schedule?: CronSchedule;
  transformations?: TransformationRule[];
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface CronSchedule {
  expression: string; // Standard cron format (minute hour day month dayOfWeek)
  timezone?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface TransformationRule {
  id: string;
  name: string;
  type: 'filter' | 'map' | 'aggregate' | 'custom';
  config: Record<string, any>;
  order: number;
}

export interface TransformationTemplate {
  id: string;
  name: string;
  description: string;
  rules: TransformationRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportPreview {
  filename: string;
  format: ExportFormat;
  rowCount: number;
  columnCount: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  fileSize: number;
  estimatedMemory: number;
}

export interface ImportValidationError {
  row?: number;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsSkipped: number;
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
  importedAt: Date;
}

export interface ExportHistory {
  id: string;
  jobId?: string;
  filename: string;
  format: ExportFormat;
  recordCount: number;
  fileSize: number;
  exportedAt: Date;
  duration: number; // milliseconds
  status: 'success' | 'failed';
  error?: string;
}
