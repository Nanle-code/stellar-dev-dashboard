# Quick Reference - Data Export/Import System

## One-Minute Quick Start

### Import the Hook
```javascript
import { useDataExportEnhanced } from '../hooks/useDataExportEnhanced';

const {
  exportData, importData, scheduleExport, 
  transformations, addTransformation, ...
} = useDataExportEnhanced();
```

### Basic Export
```javascript
// CSV
await exportData(data, 'csv', 'filename');

// JSON
await exportData(data, 'json', 'filename');

// XML
await exportData(data, 'xml', 'filename');

// Parquet
await exportData(data, 'parquet', 'filename');

// PDF
await exportData(data, 'pdf', 'filename');
```

### Basic Import
```javascript
const result = await importData(file, 'json', schema);
if (result.success) {
  // Use result.data
}
```

### Use Components
```javascript
<ExportDialog isOpen={show} data={data} onClose={...} onExport={...} />
<ImportDialog isOpen={show} onClose={...} onPreview={...} onImport={...} />
<TransformationBuilder transformations={...} onAddRule={...} />
<ScheduleManager jobs={...} onAddJob={...} />
```

---

## Common Tasks

### Export with Transformation
```javascript
// Add filter rule
addTransformation({
  type: 'filter',
  config: { field: 'amount', operator: 'greaterThan', value: 1000 },
});

// Then export (transformations apply automatically)
await exportData(data, 'csv', 'large-transactions');
```

### Schedule Daily Export
```javascript
scheduleExport('Daily Backup', 'json', {
  expression: '0 0 * * *', // Midnight daily
});
```

### Import with Validation
```javascript
const schema = {
  email: { type: 'string', required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
  age: { type: 'number', min: 0, max: 150 },
};

const result = await importData(file, 'json', schema);
result.errors.forEach(e => console.error(`Row ${e.row}: ${e.message}`));
```

---

## Cron Expressions

| Expression | Schedule |
|---|---|
| `0 0 * * *` | Daily at midnight |
| `0 0 * * 0` | Weekly (Sunday) |
| `0 0 1 * *` | Monthly (1st day) |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 * * 0,6` | Weekends |
| `0 */6 * * *` | Every 6 hours |

---

## Filter Operators

```javascript
// Comparison
'equals'        // row.field === value
'notEquals'     // row.field !== value
'greaterThan'   // row.field > value
'lessThan'      // row.field < value
'greaterOrEqual' // row.field >= value
'lessOrEqual'   // row.field <= value

// String
'contains'      // row.field includes value
'notContains'   // !row.field includes value
'startsWith'    // row.field.startsWith(value)
'endsWith'      // row.field.endsWith(value)

// Collection
'in'            // value.includes(row.field)
'notIn'         // !value.includes(row.field)
```

---

## Transformation Templates

```javascript
import { TRANSFORMATION_TEMPLATES } from '../lib/transformationPipeline';

// Anonymize (removes email, phone, address)
applyTemplate(TRANSFORMATION_TEMPLATES.anonymize);

// Financial Summary (group by asset, sum/avg balances)
applyTemplate(TRANSFORMATION_TEMPLATES.financialSummary);

// Large Transactions (amount > 1000)
applyTemplate(TRANSFORMATION_TEMPLATES.largeTransactions);

// Date Range (last 30 days)
applyTemplate(TRANSFORMATION_TEMPLATES.dateRange);
```

---

## Validation Rules

```javascript
const schema = {
  field: {
    type: 'string|number|boolean|array',  // Data type
    required: true,                         // Required field
    minLength: 1,                          // Minimum string length
    maxLength: 100,                        // Maximum string length
    min: 0,                                // Minimum value
    max: 100,                              // Maximum value
    pattern: '^[A-Z]+$',                   // Regex pattern
    enum: ['active', 'inactive'],          // Allowed values
    validate: (value) => value > 0,        // Custom validator
    customMessage: 'Custom error',         // Custom error message
  },
};
```

---

## Hook Configuration

```javascript
const { ... } = useDataExportEnhanced({
  maxFileSizeMB: 100,        // File size limit (default: 100)
  enableScheduling: true,    // Enable scheduled jobs (default: true)
  defaultFormat: 'json',     // Default export format (default: 'json')
});
```

---

## Error Handling

```javascript
try {
  await exportData(data, 'csv', 'file');
} catch (error) {
  console.error('Export failed:', error.message);
}

// Import errors
const result = await importData(file, 'json', schema);
if (!result.success) {
  result.errors.forEach(e => {
    console.error(`Row ${e.row}, Column ${e.column}: ${e.message}`);
  });
}
```

---

## File Size

```javascript
import { validateImportSize } from '../lib/importEnhanced';

const validation = validateImportSize(file, 100); // 100 MB limit
if (!validation.valid) {
  console.error(validation.message);
}
```

---

## Batch Import (Large Files)

```javascript
import { batchImportProcessor } from '../lib/importEnhanced';

for await (const batch of batchImportProcessor(file, 'json', 1000)) {
  console.log(`Batch ${batch.batch}: ${batch.progress}% complete`);
  // Process batch.data
}
```

---

## Scheduler Methods

```javascript
import { getExportScheduler } from '../lib/exportScheduler';

const scheduler = getExportScheduler();

// Get jobs
const jobs = scheduler.getAllJobs();
const job = scheduler.getJob(jobId);

// Manage jobs
scheduler.addJob(job);
scheduler.updateJob(jobId, { enabled: false });
scheduler.removeJob(jobId);

// History
const history = scheduler.getHistory(jobId, 50);
scheduler.clearHistory(jobId);

// Cleanup
scheduler.shutdown();
```

---

## Common Patterns

### Download Multiple Formats
```javascript
for (const format of ['csv', 'json', 'xml']) {
  await exportData(data, format, `export_${format}`);
}
```

### Transform Before Export
```javascript
// Apply filter and anonymize
applyTemplate(TRANSFORMATION_TEMPLATES.anonymize);
addTransformation({ type: 'filter', ... });
await exportData(data, 'csv', 'sanitized');
```

### Conditional Export
```javascript
if (data.length > 1000) {
  // Use Parquet for large datasets
  await exportData(data, 'parquet', 'large-export');
} else {
  // Use CSV for small datasets
  await exportData(data, 'csv', 'small-export');
}
```

### Export with Metadata
```javascript
const enriched = {
  metadata: {
    exportedAt: new Date(),
    version: '1.0',
    recordCount: data.length,
  },
  data,
};
await exportData(enriched, 'json', 'with-metadata');
```

---

## State Management

```javascript
const {
  // Export state
  isExporting,
  exportError,
  exportHistory,

  // Import state
  isImporting,
  importError,
  importWarnings,
  importSuccess,
  importPreview,

  // Transformation state
  transformations,
  activeTemplate,

  // Scheduling state
  schedulerRunning,
  exportJobs,
} = useDataExportEnhanced();
```

---

## Limitations & Notes

- Max file size: 100MB (configurable)
- Memory usage: 2x file size (estimated)
- CSV parsing: Handles quotes and escapes
- XML: Special characters automatically escaped
- Parquet: Simplified format for educational use
- Scheduling: Client-side only (no server persistence)
- Import history: Limited to last 1000 records
- Custom rules: Use with caution (security risk)

---

## Performance Tips

1. **Large files**: Use Parquet format (more efficient)
2. **Transformations**: Apply filters first (reduces data)
3. **Import**: Batch process files > 50MB
4. **Scheduling**: Check history to avoid overlaps
5. **Memory**: Close dialogs when done

---

## Browser Requirements

- File API support
- Blob API support
- Promise/async-await
- ES6 template literals
- Object destructuring

All modern browsers supported.

---

## Additional Resources

- Full documentation: `DATA_EXPORT_IMPORT_GUIDE.md`
- Examples: `src/components/examples/DataExportImportExample.tsx`
- Tests: `tests/unit/dataExportImport.test.ts`
- Types: `src/types/dataExport.ts`

---

**Last Updated:** 2024
**Status:** Production Ready
