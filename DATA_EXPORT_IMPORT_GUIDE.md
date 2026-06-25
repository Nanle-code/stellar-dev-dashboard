# Data Export/Import System Documentation

## Overview

The Stellar Dev Dashboard now includes a comprehensive data export/import system with four main components:

1. **Export Formats** - CSV, JSON, XML, Parquet, PDF
2. **Transformation Pipeline** - Data transformation rules and templates
3. **Scheduling** - Cron-based automated export jobs
4. **Import System** - File upload with preview, validation, and error handling

## Architecture

### Directory Structure

```
src/
├── types/
│   └── dataExport.ts              # TypeScript type definitions
├── utils/
│   ├── export.js                  # Original export utilities
│   └── exportExtended.js           # Extended format support (XML, Parquet)
├── lib/
│   ├── transformationPipeline.ts   # Data transformation engine
│   ├── exportScheduler.ts          # Cron-based scheduler
│   └── importEnhanced.ts           # Enhanced import with preview
├── hooks/
│   ├── useDataExport.js            # Original hook
│   └── useDataExportEnhanced.ts    # Full-featured hook
└── components/common/
    ├── ExportDialog.tsx            # Export UI component
    ├── ExportDialog.css
    ├── ImportDialog.tsx            # Import UI component
    ├── ImportDialog.css
    ├── TransformationBuilder.tsx   # Transformation UI component
    ├── TransformationBuilder.css
    ├── ScheduleManager.tsx         # Schedule UI component
    └── ScheduleManager.css
```

## Step 1: Export Formats

### Supported Formats

#### CSV
```javascript
import { exportCsv } from '../utils/export';

const data = [
  { id: 1, name: 'Alice', balance: 1000 },
  { id: 2, name: 'Bob', balance: 2000 },
];

exportCsv(data, 'export_filename', ['id', 'name', 'balance']);
```

#### JSON
```javascript
import { exportJson } from '../utils/export';

const data = { /* ... */ };
exportJson(data, 'export_filename');
```

#### XML
```javascript
import { exportXml } from '../utils/exportExtended';

const data = [{ /* ... */ }];
exportXml(data, 'export_filename', 'root', 'item');
```

#### Parquet
```javascript
import { exportParquet } from '../utils/exportExtended';

const data = [{ /* ... */ }];
exportParquet(data, 'export_filename');
```

#### PDF
```javascript
import { exportPdf } from '../utils/export';

const text = 'Your text content';
exportPdf(text, 'export_filename');
```

### Generic Export Handler

```javascript
import { exportData } from '../utils/exportExtended';

await exportData(data, 'csv', 'myfile', {
  columns: ['id', 'name', 'balance'],
});
```

## Step 2: Transformation Pipeline

### Predefined Templates

```javascript
import { TRANSFORMATION_TEMPLATES } from '../lib/transformationPipeline';

// Anonymize data
const template = TRANSFORMATION_TEMPLATES.anonymize;

// Financial summary
const summary = TRANSFORMATION_TEMPLATES.financialSummary;

// Large transactions filter
const large = TRANSFORMATION_TEMPLATES.largeTransactions;

// Date range filter
const dateRange = TRANSFORMATION_TEMPLATES.dateRange;
```

### Creating Custom Rules

#### Filter Rule
```javascript
const filterRule = {
  id: 'filter_1',
  name: 'Amount > 1000',
  type: 'filter',
  config: {
    field: 'amount',
    operator: 'greaterThan',  // equals, notEquals, greaterThan, etc.
    value: 1000,
  },
  order: 0,
  enabled: true,
};
```

#### Map Rule
```javascript
const mapRule = {
  id: 'map_1',
  name: 'Rename and transform',
  type: 'map',
  config: {
    operations: [
      { type: 'rename', field: 'user_id', newField: 'userId' },
      { type: 'remove', field: 'temp_field' },
      { type: 'add', field: 'processed', value: true },
      { type: 'compute', field: 'total', formula: '{amount} * 1.1' },
    ],
  },
  order: 1,
  enabled: true,
};
```

#### Aggregate Rule
```javascript
const aggregateRule = {
  id: 'agg_1',
  name: 'Group by asset',
  type: 'aggregate',
  config: {
    groupBy: ['asset_code'],
    aggregations: [
      { field: 'balance', operation: 'sum' },
      { field: 'balance', operation: 'avg' },
      { field: 'balance', operation: 'min' },
      { field: 'balance', operation: 'max' },
      { field: 'balance', operation: 'count' },
    ],
  },
  order: 2,
  enabled: true,
};
```

#### Custom Rule
```javascript
const customRule = {
  id: 'custom_1',
  name: 'Custom transformation',
  type: 'custom',
  config: {
    functionBody: `
      return {
        ...row,
        formatted_amount: '$' + row.amount.toFixed(2),
        uppercase_name: row.name.toUpperCase(),
      };
    `,
  },
  order: 3,
  enabled: true,
};
```

### Applying Transformations

```javascript
import { applyTransformationPipeline } from '../lib/transformationPipeline';

const rules = [filterRule, mapRule, aggregateRule];
const transformedData = applyTransformationPipeline(data, rules);
```

## Step 3: Scheduling

### Cron Expressions

Format: `minute hour day month dayOfWeek`

Common schedules:
```javascript
'0 0 * * *'      // Daily at midnight
'0 0 * * 0'      // Weekly (Sunday at midnight)
'0 0 1 * *'      // Monthly (1st at midnight)
'*/15 * * * *'   // Every 15 minutes
'0 9 * * 1-5'    // Weekdays at 9 AM
'0 0 * * 0,6'    // Weekends at midnight
'0 */6 * * *'    // Every 6 hours
```

### Creating Scheduled Jobs

```javascript
import { getExportScheduler, createExportJob } from '../lib/exportScheduler';

const scheduler = getExportScheduler();

const job = createExportJob(
  'Daily Backup',
  'json',
  { expression: '0 0 * * *', timezone: 'UTC' },
  { transformations: [] }
);

scheduler.addJob(job);
```

### Managing Jobs

```javascript
// Get all jobs
const jobs = scheduler.getAllJobs();

// Get specific job
const job = scheduler.getJob(jobId);

// Update job
scheduler.updateJob(jobId, {
  enabled: false,
  schedule: { expression: '0 2 * * *' },
});

// Remove job
scheduler.removeJob(jobId);

// Get export history
const history = scheduler.getHistory(jobId, 50);

// Clear history
scheduler.clearHistory(jobId);
```

### Using with React Hook

```javascript
import { useDataExportEnhanced } from '../hooks/useDataExportEnhanced';

export function MyComponent() {
  const {
    exportJobs,
    scheduleExport,
    updateScheduledJob,
    removeScheduledJob,
    getExportHistory,
  } = useDataExportEnhanced();

  const handleSchedule = () => {
    scheduleExport('Daily Export', 'csv', {
      expression: '0 0 * * *',
    });
  };

  return (
    // Component JSX
  );
}
```

## Step 4: Import System

### File Upload and Preview

```javascript
import { generateImportPreview } from '../lib/importEnhanced';

const file = fileInputElement.files[0];
const preview = await generateImportPreview(file, 'json', 5);

// Preview structure:
// {
//   filename: 'data.json',
//   format: 'json',
//   rowCount: 1000,
//   columnCount: 5,
//   columns: ['id', 'name', 'email', 'balance', 'date'],
//   sampleRows: [...],  // First 5 rows
//   fileSize: 102400,
//   estimatedMemory: 204800,
// }
```

### Validation Schema

```javascript
const schema = {
  email: {
    type: 'string',
    required: true,
    pattern: '^[^@]+@[^@]+\\.[^@]+$',
  },
  age: {
    type: 'number',
    min: 0,
    max: 150,
  },
  status: {
    type: 'string',
    enum: ['active', 'inactive', 'pending'],
  },
  amount: {
    type: 'number',
    required: true,
  },
};
```

### Processing Import

```javascript
import { importData } from '../lib/importEnhanced';

const result = await importData(file, 'json', schema, false);

// Result structure:
// {
//   success: true,
//   recordsProcessed: 950,
//   recordsSkipped: 50,
//   errors: [...],        // Validation errors
//   warnings: [...],      // Validation warnings
//   importedAt: Date,
// }
```

### Batch Processing for Large Files

```javascript
import { batchImportProcessor } from '../lib/importEnhanced';

const file = userSelectedFile;
for await (const batch of batchImportProcessor(file, 'json', 1000)) {
  console.log(`Processing batch ${batch.batch}: ${batch.progress}%`);
  // Process batch.data
}
```

## Using React Components

### ExportDialog

```jsx
import { ExportDialog } from '../components/common/ExportDialog';

<ExportDialog
  isOpen={showExport}
  data={myData}
  onClose={() => setShowExport(false)}
  onExport={async (data, format, filename) => {
    await exportData(data, format, filename);
  }}
  onSchedule={(name, format, schedule) => {
    scheduleExport(name, format, schedule);
  }}
  defaultFilename="export"
/>
```

### ImportDialog

```jsx
import { ImportDialog } from '../components/common/ImportDialog';

<ImportDialog
  isOpen={showImport}
  onClose={() => setShowImport(false)}
  onPreview={previewImport}
  onImport={importData}
  supportedFormats={['json', 'csv', 'xml', 'parquet']}
/>
```

### TransformationBuilder

```jsx
import { TransformationBuilder } from '../components/common/TransformationBuilder';

<TransformationBuilder
  transformations={transformations}
  templates={Object.values(TRANSFORMATION_TEMPLATES)}
  onAddRule={addTransformation}
  onRemoveRule={removeTransformation}
  onApplyTemplate={applyTemplate}
/>
```

### ScheduleManager

```jsx
import { ScheduleManager } from '../components/common/ScheduleManager';

<ScheduleManager
  jobs={exportJobs}
  onAddJob={scheduleExport}
  onUpdateJob={updateScheduledJob}
  onRemoveJob={removeScheduledJob}
  history={getExportHistory()}
/>
```

## Complete Hook Usage

```javascript
import { useDataExportEnhanced } from '../hooks/useDataExportEnhanced';

export function DataManagementPanel() {
  const {
    // Export
    isExporting,
    exportError,
    exportHistory,
    exportData,

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
  } = useDataExportEnhanced({
    maxFileSizeMB: 100,
    enableScheduling: true,
    defaultFormat: 'json',
  });

  // Use all these functions and state...
}
```

## Error Handling

### Export Errors
```javascript
try {
  await exportData(data, 'csv', 'myfile');
} catch (error) {
  console.error('Export failed:', error.message);
}
```

### Import Validation Errors
```javascript
const result = await importData(file, 'json', schema);

if (!result.success) {
  result.errors.forEach((error) => {
    console.log(
      `Row ${error.row}, Column ${error.column}: ${error.message}`
    );
  });
}

result.warnings.forEach((warning) => {
  console.warn(`Warning: ${warning.message}`);
});
```

### File Size Validation
```javascript
import { validateImportSize } from '../lib/importEnhanced';

const validation = validateImportSize(file, 100); // 100 MB limit
if (!validation.valid) {
  console.error(validation.message);
}
```

## Performance Considerations

1. **Large Datasets**: Use batch processing for files > 50MB
2. **Transformations**: Apply filters early to reduce data size
3. **Scheduling**: Check job history to avoid overlapping runs
4. **Memory**: Use Parquet format for columnar storage efficiency

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- File API support required
- Blob API support required
- Promise/async-await support required

## Security

- File validation before processing
- Schema-based validation for imports
- Size limits on file uploads
- Sanitization of XML/HTML content
- No external API calls for basic operations

## Future Enhancements

- Real-time sync to cloud storage
- Webhook notifications for scheduled jobs
- Advanced filtering UI
- Compression support (gzip, brotli)
- Database export/import
- API-based import/export
