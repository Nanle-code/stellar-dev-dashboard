/**
 * Enhanced useDataExport hook with full export/import pipeline
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { exportData } from '../utils/exportExtended';
import {
  generateImportPreview,
  validateImportData,
  processImport,
  validateImportSize,
  batchImportProcessor,
} from '../lib/importEnhanced';
import {
  applyTransformationPipeline,
  createTransformationTemplate,
} from '../lib/transformationPipeline';
import {
  getExportScheduler,
  createExportJob,
  getNextExecutionTime,
} from '../lib/exportScheduler';
import type {
  ExportFormat,
  ExportJob,
  ExportHistory,
  ImportPreview,
  TransformationRule,
} from '../types/dataExport';

interface UseDataExportOptions {
  maxFileSizeMB?: number;
  enableScheduling?: boolean;
  defaultFormat?: ExportFormat;
}

export function useDataExport(options = {} as UseDataExportOptions) {
  const {
    maxFileSizeMB = 100,
    enableScheduling = true,
    defaultFormat = 'json' as ExportFormat,
  } = options;

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportHistory, setExportHistory] = useState([]);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // Transformation state
  const [transformations, setTransformations] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);

  // Scheduling state
  const [exportJobs, setExportJobs] = useState([]);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const schedulerRef = useRef(null);

  // Initialize scheduler
  useEffect(() => {
    if (enableScheduling && !schedulerRef.current) {
      schedulerRef.current = getExportScheduler();
      setSchedulerRunning(true);
    }

    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.shutdown();
        schedulerRef.current = null;
      }
    };
  }, [enableScheduling]);

  /**
   * Export data with optional transformations
   */
  const exportDataWithTransformations = useCallback(
    async (data, format = defaultFormat, filename, applyTransforms = true) => {
      setIsExporting(true);
      setExportError(null);

      try {
        let processedData = data;

        // Apply transformations if enabled
        if (applyTransforms && transformations.length > 0) {
          processedData = applyTransformationPipeline(data, transformations);
        }

        // Export
        await exportData(processedData, format, filename);

        // Record history
        const historyEntry = {
          id: `export_${Date.now()}`,
          filename: `${filename}.${format}`,
          format,
          recordCount: processedData.length,
          fileSize: JSON.stringify(processedData).length,
          exportedAt: new Date(),
          duration: 0,
          status: 'success' as const,
        };

        setExportHistory((prev) => [...prev, historyEntry]);
      } catch (err) {
        setExportError(err.message);
      } finally {
        setIsExporting(false);
      }
    },
    [transformations, defaultFormat]
  );

  /**
   * Generate import preview
   */
  const previewImport = useCallback(
    async (file, format = 'json' as ExportFormat) => {
      try {
        setImportError(null);

        // Validate file size
        const sizeValidation = validateImportSize(file, maxFileSizeMB);
        if (!sizeValidation.valid) {
          setImportError(sizeValidation.message);
          return null;
        }

        // Generate preview
        const preview = await generateImportPreview(file, format);
        setImportPreview(preview);
        return preview;
      } catch (err) {
        setImportError(err.message);
        return null;
      }
    },
    [maxFileSizeMB]
  );

  /**
   * Import data with validation
   */
  const importData = useCallback(
    async (file, format = 'json' as ExportFormat, schema = {}, skipErrors = false) => {
      setIsImporting(true);
      setImportError(null);
      setImportWarnings([]);
      setImportSuccess(false);

      try {
        // Validate file size
        const sizeValidation = validateImportSize(file, maxFileSizeMB);
        if (!sizeValidation.valid) {
          throw new Error(sizeValidation.message);
        }

        // For large files, use batch processor
        let allData = [];
        const batchGen = batchImportProcessor(file, format, 5000);

        for await (const batch of batchGen) {
          allData = allData.concat(batch.data);
        }

        // Validate data
        const validationErrors = validateImportData(allData, schema);
        const errors = validationErrors.filter((e) => e.severity === 'error');
        const warnings = validationErrors.filter((e) => e.severity === 'warning');

        if (errors.length > 0 && !skipErrors) {
          throw new Error(
            `Validation failed: ${errors.length} errors found`
          );
        }

        setImportWarnings(warnings);

        // Process import
        const result = processImport(allData, {
          schema,
          skipErrors,
          limit: 100000, // Safety limit
        });

        if (!result.success && !skipErrors) {
          throw new Error(`Import failed: ${result.errors[0]?.message}`);
        }

        setImportSuccess(result.success);
        return { data: allData, result };
      } catch (err) {
        setImportError(err.message);
        setImportSuccess(false);
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [maxFileSizeMB]
  );

  /**
   * Add transformation rule
   */
  const addTransformation = useCallback((rule) => {
    setTransformations((prev) => [
      ...prev,
      { ...rule, order: prev.length },
    ]);
  }, []);

  /**
   * Remove transformation rule
   */
  const removeTransformation = useCallback((ruleId) => {
    setTransformations((prev) => prev.filter((r) => r.id !== ruleId));
  }, []);

  /**
   * Apply transformation template
   */
  const applyTemplate = useCallback((template) => {
    setTransformations(template.rules);
    setActiveTemplate(template.id);
  }, []);

  /**
   * Create and schedule export job
   */
  const scheduleExport = useCallback(
    (name, format, cronSchedule, options = {}) => {
      if (!schedulerRef.current) {
        setExportError('Scheduler not initialized');
        return null;
      }

      try {
        const job = createExportJob(name, format, cronSchedule, options);
        schedulerRef.current.addJob(job);

        setExportJobs((prev) => [...prev, job]);
        return job.id;
      } catch (err) {
        setExportError(err.message);
        return null;
      }
    },
    []
  );

  /**
   * Get scheduled jobs
   */
  const getScheduledJobs = useCallback(() => {
    if (!schedulerRef.current) return [];
    return schedulerRef.current.getAllJobs();
  }, []);

  /**
   * Update scheduled job
   */
  const updateScheduledJob = useCallback(
    (jobId, updates) => {
      if (!schedulerRef.current) return null;

      try {
        const updated = schedulerRef.current.updateJob(jobId, updates);
        setExportJobs((prev) =>
          prev.map((j) => (j.id === jobId ? updated : j))
        );
        return updated;
      } catch (err) {
        setExportError(err.message);
        return null;
      }
    },
    []
  );

  /**
   * Remove scheduled job
   */
  const removeScheduledJob = useCallback((jobId) => {
    if (!schedulerRef.current) return false;

    try {
      schedulerRef.current.removeJob(jobId);
      setExportJobs((prev) => prev.filter((j) => j.id !== jobId));
      return true;
    } catch (err) {
      setExportError(err.message);
      return false;
    }
  }, []);

  /**
   * Get export history
   */
  const getExportHistory = useCallback(
    (jobId = null, limit = 50) => {
      if (!schedulerRef.current) return [];
      return schedulerRef.current.getHistory(jobId, limit);
    },
    []
  );

  return {
    // Export
    isExporting,
    exportError,
    exportHistory,
    exportData: exportDataWithTransformations,

    // Import
    isImporting,
    importError,
    importWarnings,
    importSuccess,
    importPreview,
    previewImport,
    importData,

    // Transformations
    transformations,
    activeTemplate,
    addTransformation,
    removeTransformation,
    applyTemplate,

    // Scheduling
    schedulerRunning,
    exportJobs,
    scheduleExport,
    getScheduledJobs,
    updateScheduledJob,
    removeScheduledJob,
    getExportHistory,
  };
}
