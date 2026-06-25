/**
 * Tests for Data Export/Import System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportCsv,
  exportJson,
  buildXmlString,
  exportXml,
  exportParquet,
} from '../utils/exportExtended';
import {
  applyTransformationRule,
  applyTransformationPipeline,
  createTransformationTemplate,
  validateTransformationRule,
  getTransformationTemplate,
  TRANSFORMATION_TEMPLATES,
} from '../lib/transformationPipeline';
import {
  parseCronExpression,
  matchesCronExpression,
  getNextExecutionTime,
  createExportJob,
  ExportScheduler,
} from '../lib/exportScheduler';
import {
  parseJsonContent,
  parseCsvContent,
  parseXmlContent,
  validateImportData,
  validateField,
  processImport,
  validateImportSize,
} from '../lib/importEnhanced';

/**
 * Export Format Tests
 */
describe('Export Formats', () => {
  const testData = [
    { id: 1, name: 'Alice', balance: 1000 },
    { id: 2, name: 'Bob', balance: 2000 },
  ];

  it('should build valid XML string', () => {
    const xml = buildXmlString(testData, 'data', 'row');
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<data>');
    expect(xml).toContain('<id>1</id>');
    expect(xml).toContain('</data>');
  });

  it('should handle XML special characters', () => {
    const dataWithSpecialChars = [
      { text: 'Hello & goodbye', value: '<tag>' },
    ];
    const xml = buildXmlString(dataWithSpecialChars);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
  });

  it('should handle empty data arrays', () => {
    const xml = buildXmlString([]);
    expect(xml).toContain('<data>');
    expect(xml).toContain('</data>');
  });
});

/**
 * Transformation Pipeline Tests
 */
describe('Transformation Pipeline', () => {
  const testData = [
    { id: 1, name: 'Alice', amount: 1500, status: 'active' },
    { id: 2, name: 'Bob', amount: 500, status: 'inactive' },
    { id: 3, name: 'Charlie', amount: 2500, status: 'active' },
  ];

  describe('Filter Rule', () => {
    it('should filter by greater than', () => {
      const rule = {
        id: 'f1',
        name: 'Amount > 1000',
        type: 'filter',
        config: { field: 'amount', operator: 'greaterThan', value: 1000 },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result.length).toBe(2);
      expect(result.every((r) => r.amount > 1000)).toBe(true);
    });

    it('should filter by equals', () => {
      const rule = {
        id: 'f2',
        name: 'Active only',
        type: 'filter',
        config: { field: 'status', operator: 'equals', value: 'active' },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result.length).toBe(2);
    });

    it('should filter by contains', () => {
      const rule = {
        id: 'f3',
        name: 'Name contains li',
        type: 'filter',
        config: { field: 'name', operator: 'contains', value: 'li' },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result.length).toBe(2); // Alice, Charlie
    });
  });

  describe('Map Rule', () => {
    it('should rename fields', () => {
      const rule = {
        id: 'm1',
        name: 'Rename',
        type: 'map',
        config: {
          operations: [{ type: 'rename', field: 'id', newField: 'user_id' }],
        },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result[0]).toHaveProperty('user_id');
      expect(result[0]).not.toHaveProperty('id');
    });

    it('should remove fields', () => {
      const rule = {
        id: 'm2',
        name: 'Remove',
        type: 'map',
        config: {
          operations: [{ type: 'remove', field: 'status' }],
        },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result[0]).not.toHaveProperty('status');
    });

    it('should add fields', () => {
      const rule = {
        id: 'm3',
        name: 'Add',
        type: 'map',
        config: {
          operations: [{ type: 'add', field: 'processed', value: true }],
        },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result[0]).toHaveProperty('processed');
      expect(result[0].processed).toBe(true);
    });
  });

  describe('Aggregate Rule', () => {
    it('should group and aggregate', () => {
      const rule = {
        id: 'a1',
        name: 'Group by status',
        type: 'aggregate',
        config: {
          groupBy: ['status'],
          aggregations: [{ field: 'amount', operation: 'sum' }],
        },
        order: 0,
        enabled: true,
      };

      const result = applyTransformationRule(testData, rule);
      expect(result.length).toBe(2); // Two statuses
      expect(result.find((r) => r.status === 'active').amount_sum).toBe(4000);
    });
  });

  describe('Pipeline', () => {
    it('should apply multiple rules in order', () => {
      const rules = [
        {
          id: 'f1',
          name: 'Filter',
          type: 'filter',
          config: { field: 'amount', operator: 'greaterThan', value: 500 },
          order: 0,
          enabled: true,
        },
        {
          id: 'm1',
          name: 'Map',
          type: 'map',
          config: {
            operations: [{ type: 'add', field: 'filtered', value: true }],
          },
          order: 1,
          enabled: true,
        },
      ];

      const result = applyTransformationPipeline(testData, rules);
      expect(result.every((r) => r.amount > 500)).toBe(true);
      expect(result.every((r) => r.filtered === true)).toBe(true);
    });
  });

  describe('Templates', () => {
    it('should get template by name', () => {
      const template = getTransformationTemplate('anonymize');
      expect(template).toBeDefined();
      expect(template.name).toBe('Anonymize Data');
    });

    it('should validate template rules', () => {
      const template = TRANSFORMATION_TEMPLATES.anonymize;
      template.rules.forEach((rule) => {
        const errors = validateTransformationRule(rule);
        expect(errors.length).toBe(0);
      });
    });
  });
});

/**
 * Scheduling Tests
 */
describe('Export Scheduling', () => {
  describe('Cron Parsing', () => {
    it('should parse daily cron', () => {
      const parsed = parseCronExpression('0 0 * * *');
      expect(parsed.minute).toContain(0);
      expect(parsed.hour).toContain(0);
    });

    it('should parse step values', () => {
      const parsed = parseCronExpression('*/15 * * * *');
      expect(parsed.minute).toContain(0);
      expect(parsed.minute).toContain(15);
      expect(parsed.minute).toContain(30);
      expect(parsed.minute).toContain(45);
    });

    it('should parse ranges', () => {
      const parsed = parseCronExpression('0 9-17 * * 1-5');
      expect(parsed.hour).toContain(9);
      expect(parsed.hour).toContain(17);
      expect(parsed.dayOfWeek).toHaveLength(5);
    });

    it('should return null for invalid cron', () => {
      const parsed = parseCronExpression('invalid');
      expect(parsed).toBeNull();
    });
  });

  describe('Cron Matching', () => {
    it('should match correct datetime', () => {
      const date = new Date('2024-01-01T00:00:00Z'); // Midnight on 1st
      expect(matchesCronExpression(date, '0 0 1 * *')).toBe(true);
    });

    it('should not match wrong datetime', () => {
      const date = new Date('2024-01-01T01:00:00Z'); // 1 AM
      expect(matchesCronExpression(date, '0 0 * * *')).toBe(false);
    });
  });

  describe('Scheduler', () => {
    let scheduler;

    beforeEach(() => {
      scheduler = new ExportScheduler(60000);
    });

    it('should create job', () => {
      const job = createExportJob('Test', 'json', {
        expression: '0 0 * * *',
      });

      expect(job).toHaveProperty('id');
      expect(job.name).toBe('Test');
      expect(job.format).toBe('json');
      expect(job.enabled).toBe(true);
    });

    it('should add and retrieve job', () => {
      const job = createExportJob('Test', 'json', {
        expression: '0 0 * * *',
      });

      scheduler.addJob(job);
      const retrieved = scheduler.getJob(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Test');
    });

    it('should remove job', () => {
      const job = createExportJob('Test', 'json', {
        expression: '0 0 * * *',
      });

      scheduler.addJob(job);
      const removed = scheduler.removeJob(job.id);

      expect(removed).toBe(true);
      expect(scheduler.getJob(job.id)).toBeUndefined();
    });

    it('should record history', () => {
      scheduler.recordHistory({
        id: '1',
        filename: 'test.json',
        format: 'json',
        recordCount: 100,
        fileSize: 1024,
        exportedAt: new Date(),
        duration: 1000,
        status: 'success',
      });

      const history = scheduler.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].filename).toBe('test.json');
    });
  });
});

/**
 * Import Tests
 */
describe('Import System', () => {
  describe('Parsing', () => {
    it('should parse JSON content', () => {
      const json = '[{"id":1,"name":"Alice"}]';
      const result = parseJsonContent(json);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].name).toBe('Alice');
    });

    it('should parse CSV content', () => {
      const csv = 'id,name\n1,Alice\n2,Bob';
      const result = parseCsvContent(csv);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Alice');
    });

    it('should handle CSV with quotes', () => {
      const csv = 'id,name,email\n1,"Alice Smith","alice@example.com"';
      const result = parseCsvContent(csv);
      expect(result[0].name).toBe('Alice Smith');
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const errors = validateField(undefined, 'email', { required: true }, 0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate type', () => {
      const errors = validateField('123', 'age', { type: 'number' }, 0);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate pattern', () => {
      const errors = validateField(
        'invalid-email',
        'email',
        { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        0
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate enum', () => {
      const errors = validateField(
        'invalid',
        'status',
        { enum: ['active', 'inactive'] },
        0
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate min/max', () => {
      const errors = validateField('5', 'value', { min: 10, max: 100 }, 0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Import Processing', () => {
    it('should process valid data', () => {
      const data = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      const result = processImport(data, {
        schema: {
          id: { type: 'number', required: true },
          name: { type: 'string', required: true },
        },
      });

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
    });

    it('should skip errors when requested', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: null, name: 'Bob' }, // Invalid
        { id: 3, name: 'Charlie' },
      ];

      const result = processImport(data, {
        schema: { id: { type: 'number', required: true } },
        skipErrors: true,
      });

      expect(result.recordsSkipped).toBe(1);
      expect(result.recordsProcessed).toBe(2);
    });

    it('should apply transformation', () => {
      const data = [{ id: 1, name: 'alice' }];

      const result = processImport(data, {
        transform: (row) => ({
          ...row,
          name: row.name.toUpperCase(),
        }),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('File Size Validation', () => {
    it('should validate file size', () => {
      const file = new File(['content'], 'test.json', {
        type: 'application/json',
      });

      const result = validateImportSize(file, 1);
      expect(result.valid).toBe(true);
    });

    it('should reject oversized file', () => {
      // Create a larger file mock
      const file = new File(
        [new ArrayBuffer(101 * 1024 * 1024)],
        'large.json',
        { type: 'application/json' }
      );

      const result = validateImportSize(file, 100);
      expect(result.valid).toBe(false);
    });
  });
});

export {};
