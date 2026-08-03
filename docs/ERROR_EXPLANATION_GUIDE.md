# AI-Powered Error Message Explanation Guide

## Overview

This guide explains the AI-powered error message explanation system for the Stellar Dev Dashboard. The system translates technical Stellar network error messages into plain-language explanations with actionable guidance using machine learning and template-based explanations.

## Architecture

The error explanation system consists of several key components:

### 1. Error Database (`errorDatabase.ts`)
Comprehensive database of Stellar error codes with:
- **Plain-language explanations** for each error
- **Technical details** for developers
- **Common causes** of errors
- **Suggested solutions** with actionable steps
- **Related documentation** links
- **Severity levels** (low, medium, high, critical)
- **Retryability** information

### 2. ML Suggestion Engine (`mlSuggestionEngine.ts`)
TensorFlow.js-powered context-aware suggestion system that:
- Extracts features from error context (operation, component, account state, network state)
- Uses neural network to prioritize suggestions
- Learns from user feedback to improve suggestions
- Provides context-specific recommendations
- Estimates resolution time

### 3. Integration Layer (`errorExplanationIntegration.ts`)
Integration with existing error handling system:
- Extracts error codes from various error formats
- Provides quick explanations without ML
- Offers React hook for component integration
- Records user feedback for continuous learning

### 4. Dashboard UI (`ErrorExplanationPanel.tsx`)
React component for displaying error explanations:
- Plain-language error descriptions
- AI-powered suggestions with confidence scores
- User feedback system (helpful/not helpful)
- Technical details toggle
- Error database search
- Related errors display

## Error Coverage

The system covers **40+ error types** across multiple categories:

### Stellar Transaction Result Codes
- `tx_success`, `tx_failed`, `tx_too_early`, `tx_too_late`
- `tx_bad_seq`, `tx_bad_auth`, `tx_insufficient_balance`
- `tx_insufficient_fee`, `tx_no_account`

### Stellar Operation Result Codes
- `op_success`, `op_no_destination`, `op_no_trust`
- `op_underfunded`, `op_low_reserve`, `op_src_not_authorized`
- `op_line_full`, `op_no_issuer`

### HTTP Status Codes
- `400`, `401`, `403`, `404`, `409`, `429`
- `500`, `502`, `503`, `504`

### Network Errors
- `network_error`, `timeout`

### Soroban RPC Errors
- `-32600`, `-32601`, `-32602`, `-32603`
- `-32001`, `-32002`

### Common Error Messages
- `account not found`, `invalid public key`, `insufficient balance`
- `horizon server`, `soroban rpc`, `rate limit`
- `unauthorized`, `forbidden`

## Usage Examples

### Basic Error Explanation

```typescript
import { explainErrorWithAI } from './lib/errorExplanation/errorExplanationIntegration';

const error = new Error('Transaction failed: tx_insufficient_balance');

const explanation = await explainErrorWithAI(error, {
  component: 'TransactionBuilder',
  operation: 'payment',
  userAction: 'submit_transaction',
  accountState: {
    balance: 10000000, // 1 XLM in stroops
    sequenceNumber: 12345,
    subentries: 5
  },
  networkState: {
    isOnline: true,
    latency: 500
  }
});

console.log(explanation.explanation?.plainExplanation);
console.log(explanation.suggestionResult?.contextAwareSuggestions);
```

### Quick Explanation (Without ML)

```typescript
import { getQuickExplanation } from './lib/errorExplanation/errorExplanationIntegration';

const error = new Error('404 Not Found');

const quick = getQuickExplanation(error);

console.log(quick.title);        // "Not Found"
console.log(quick.message);      // "The requested resource was not found."
console.log(quick.suggestions);  // ["Verify the account address...", "Check if the account..."]
console.log(quick.severity);     // "medium"
```

### React Hook Integration

```typescript
import { useErrorExplanation } from './lib/errorExplanation/errorExplanationIntegration';

function MyComponent() {
  const { explainError, getQuickExplanation, recordFeedback, searchErrors, stats, isInitialized } = useErrorExplanation();

  const handleTransactionError = async (error: unknown) => {
    const explanation = await explainError(error, {
      component: 'MyComponent',
      operation: 'payment'
    });

    // Display explanation to user
  };

  const handleFeedback = (helpful: boolean) => {
    recordFeedback('tx_failed', helpful, helpful ? 5 : 1, 'Check balance');
  };

  // ...
}
```

### Error Explanation Panel Component

```typescript
import ErrorExplanationPanel from './components/dashboard/ErrorExplanationPanel';

function TransactionBuilder() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <ErrorExplanationPanel
        error={error}
        options={{
          component: 'TransactionBuilder',
          operation: 'payment',
          accountState: { balance, sequenceNumber, subentries }
        }}
        onClose={() => setError(null)}
      />
    );
  }

  // ... rest of component
}
```

### Search Error Database

```typescript
import { searchErrors } from './lib/errorExplanation/errorExplanationIntegration';

const results = searchErrors('insufficient balance');

results.forEach(explanation => {
  console.log(`${explanation.code}: ${explanation.title}`);
  console.log(explanation.plainExplanation);
});
```

## ML Model Architecture

### Feature Extraction
The ML engine extracts 20 features from error context:
- Error code hash (10 features)
- Operation type encoding (1 feature)
- Component encoding (1 feature)
- Time of day (1 feature)
- Previous error count (1 feature)
- Account balance (log normalized) (1 feature)
- Network latency (normalized) (1 feature)
- Online status (1 feature)
- Error frequency (1 feature)
- Recent success rate (1 feature)
- Additional context features (2 features)

### Neural Network Structure
```
Input Layer (20 units)
    ↓
Dense Layer (64 units, ReLU)
    ↓
Dropout (0.2)
    ↓
Dense Layer (32 units, ReLU)
    ↓
Dropout (0.1)
    ↓
Dense Layer (16 units, ReLU)
    ↓
Output Layer (3 units, Softmax) → [high, medium, low] priority
```

### Training Process
- **Loss**: Categorical crossentropy
- **Optimizer**: Adam
- **Metrics**: Accuracy
- **Epochs**: 5 (retraining)
- **Batch Size**: 16
- **Storage**: IndexedDB (`stellar-error-suggestion-model`)

### Continuous Learning
- User feedback is collected and stored in localStorage
- Model retrains every 50 feedback entries
- Feedback includes: helpfulness, rating (1-5), suggestion used
- Success rate tracked for quality assessment

## User Feedback System

### Feedback Types
- **Helpful**: User found the explanation useful
- **Not Helpful**: User did not find the explanation useful
- **Rating**: 1-5 scale for detailed feedback
- **Suggestion Used**: Which specific suggestion helped

### Feedback Impact
- Improves model priority predictions
- Tracks success rate for error explanations
- Identifies most helpful suggestions
- Enables continuous improvement

### Recording Feedback

```typescript
import { recordErrorFeedback } from './lib/errorExplanation/errorExplanationIntegration';

// User clicked "Yes, helpful"
recordErrorFeedback('tx_failed', true, 5, 'Check account balance');

// User clicked "No, not helpful"
recordErrorFeedback('tx_failed', false, 1, '');
```

## API Reference

### Core Functions

#### `explainErrorWithAI(error, options)`
Generates AI-powered error explanation with context-aware suggestions.

```typescript
const explanation = await explainErrorWithAI(error, {
  component?: string,
  operation?: string,
  userAction?: string,
  accountState?: { balance: number, sequenceNumber: number, subentries: number },
  networkState?: { isOnline: boolean, latency: number },
  previousErrors?: string[]
});
```

#### `getQuickExplanation(error)`
Returns quick explanation without ML processing.

```typescript
const quick = getQuickExplanation(error);
// Returns: { title, message, suggestions, severity }
```

#### `recordErrorFeedback(errorId, helpful, rating, suggestionUsed)`
Records user feedback for continuous learning.

```typescript
recordErrorFeedback('tx_failed', true, 5, 'Check balance');
```

#### `searchErrors(keyword)`
Searches error database by keyword.

```typescript
const results = searchErrors('insufficient');
```

#### `getErrorExplanationStats()`
Returns system statistics.

```typescript
const stats = getErrorExplanationStats();
// Returns: { isInitialized, feedbackCount, trackedErrors, recentSuccessRate }
```

### Database Functions

#### `getErrorExplanation(code)`
Get explanation by error code.

```typescript
const explanation = getErrorExplanation('tx_failed');
```

#### `searchErrorExplanations(keyword)`
Search explanations by keyword.

```typescript
const results = searchErrorExplanations('balance');
```

#### `getErrorsByCategory(category)`
Get all errors in a category.

```typescript
const stellarErrors = getErrorsByCategory('stellar');
```

#### `getAllErrorCodes()`
Get all error codes in database.

```typescript
const codes = getAllErrorCodes();
```

## Integration with Existing Error Handling

### Error Handler Integration

```typescript
import { handleGlobalError } from './utils/errorHandler';
import { explainErrorWithAI } from './lib/errorExplanation/errorExplanationIntegration';

try {
  // Your code
} catch (error) {
  const errorDetails = handleGlobalError(error, 'MyComponent');
  
  // Get AI-powered explanation
  const explanation = await explainErrorWithAI(error, {
    component: 'MyComponent',
    operation: 'data_fetch'
  });
  
  // Display to user
  displayError(explanation);
}
```

### Error Boundary Integration

```typescript
import ErrorBoundary from './components/ErrorBoundary';
import ErrorExplanationPanel from './components/dashboard/ErrorExplanationPanel';

function App() {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <ErrorExplanationPanel
          error={error}
          options={{ component: 'App' }}
          onClose={resetErrorBoundary}
        />
      )}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

## Performance Characteristics

### Model Performance
- **Initialization**: ~500ms (first load)
- **Inference**: <100ms per error
- **Model Size**: ~100KB (IndexedDB)
- **Memory Usage**: ~5MB during inference

### Database Performance
- **Lookup**: <1ms per error code
- **Search**: <10ms for keyword search
- **Coverage**: 40+ error types
- **Categories**: 7 error categories

### Feedback System
- **Storage**: localStorage (up to 1000 entries)
- **Retraining**: Every 50 feedback entries
- **Training Time**: ~2 seconds
- **Success Rate Tracking**: Rolling 24-hour window

## Testing

### Running Tests

```bash
npm test -- src/lib/errorExplanation/__tests__/errorDatabase.test.ts
```

### Test Coverage
- Error database lookup and search
- ML model initialization and prediction
- Integration layer functions
- Feature extraction
- Feedback recording
- React component rendering

## Troubleshooting

### Model Not Loading
- Check IndexedDB permissions
- Verify TensorFlow.js is installed
- Clear IndexedDB and reload
- Check browser console for errors

### Poor Suggestions
- Increase training data with more feedback
- Verify context information is accurate
- Check feature extraction quality
- Review error database explanations

### Feedback Not Saving
- Check localStorage quota
- Verify localStorage is enabled
- Check for storage errors in console
- Clear old feedback if quota exceeded

### Search Not Working
- Verify error database is loaded
- Check search query format
- Ensure keyword is at least 3 characters
- Review error database content

## Best Practices

### Error Context
- Always provide as much context as possible
- Include account state when available
- Provide network state for connectivity issues
- Track previous errors for pattern detection

### User Feedback
- Encourage users to provide feedback
- Use feedback to improve suggestions
- Track success rate metrics
- Retrain model regularly with new data

### Performance
- Use quick explanations for simple cases
- Cache ML model after initialization
- Batch error explanations when possible
- Monitor memory usage

### User Experience
- Show loading states during ML processing
- Provide fallback explanations if ML fails
- Display confidence scores for suggestions
- Allow users to dismiss explanations

## Security Considerations

- **Local Processing**: All ML runs client-side, no data leaves browser
- **Privacy Preservation**: No error data sent to external servers
- **Model Storage**: Weights stored locally in IndexedDB
- **Feedback Storage**: User feedback stored in localStorage
- **No External APIs**: No dependency on external ML services

## Future Enhancements

- [ ] Add more error types from Stellar network
- [ ] Implement multilingual error explanations
- [ ] Add visual error flow diagrams
- [ ] Implement federated learning across users
- [ ] Add error prediction based on patterns
- [ ] Integrate with Stellar documentation API
- [ ] Add voice explanations for accessibility
- [ ] Implement error explanation export/import

## References

- TensorFlow.js Documentation: https://www.tensorflow.org/js
- Stellar Horizon API: https://developers.stellar.org/api/horizon/
- Stellar Error Codes: https://developers.stellar.org/docs/encyclopedia/transactions/
- Soroban RPC: https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/
