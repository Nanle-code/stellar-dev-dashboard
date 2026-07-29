# Enhanced Error Handling System

This document outlines the comprehensive error handling system implemented in the Stellar Dev Dashboard, featuring detailed error reporting, automatic retry mechanisms, error categorization, and user-friendly recovery options.

## Overview

The enhanced error handling system provides:
- **Error Categorization**: Automatic classification of errors (network, validation, stellar-specific, etc.)
- **Automatic Retry**: Intelligent retry mechanisms with exponential backoff
- **User-Friendly Recovery**: Clear error messages and actionable recovery options
- **Contextual Help**: Links to relevant documentation and troubleshooting guides
- **Detailed Reporting**: Comprehensive error tracking and analytics

## Error Categories

### 🌐 Network Errors
- Connection failures
- Timeout issues
- DNS resolution problems
- CORS errors
- Server unavailability (5xx errors)

### ⚠️ Validation Errors
- Invalid input formats
- Missing required fields
- Data format violations
- Client-side validation failures

### ⭐ Stellar-Specific Errors
- Account not found
- Insufficient balance
- Transaction failures
- Horizon/Soroban RPC issues
- Invalid public keys

### 🔐 Authentication Errors
- Unauthorized access (401)
- Missing authentication tokens
- Expired sessions

### 🚫 Permission Errors
- Forbidden access (403)
- Insufficient permissions
- Account restrictions

### ⏱️ Rate Limiting
- Too many requests (429)
- API quota exceeded
- Throttling responses

## Components

### ErrorBoundary.jsx
Enhanced React error boundary with:
- Automatic error categorization
- Retry mechanisms with exponential backoff
- Detailed error context collection
- User-friendly fallback UI

```jsx
<ErrorBoundary onRetry={handleRetry} maxRetries={3}>
  <YourComponent />
</ErrorBoundary>
```

### ErrorFallback.jsx
Comprehensive error display component featuring:
- **Responsive Design**: Mobile-optimized layout
- **Error Categorization**: Visual indicators for error types
- **Retry Mechanisms**: Smart retry buttons with attempt counters
- **Help Links**: Contextual documentation links
- **Technical Details**: Expandable error information
- **Copy Functionality**: Easy error sharing for support

### Enhanced Features
- **Touch-Optimized**: Mobile-friendly buttons and interactions
- **Accessibility**: Screen reader compatible
- **Progressive Disclosure**: Show/hide technical details
- **Visual Feedback**: Loading states and success indicators

## Error Handler Utilities

### categorizeError(error)
Automatically classifies errors based on:
- HTTP status codes
- Error messages
- Error types
- Stellar-specific patterns

### getUserFriendlyMessage(error, category)
Returns user-friendly error information:
```javascript
{
  title: "Connection Problem",
  message: "Unable to connect to Stellar network...",
  action: "Retry Connection"
}
```

### getHelpLinks(category)
Provides contextual help resources:
```javascript
[
  { label: "Network Status", url: "https://status.stellar.org/" },
  { label: "Troubleshooting Guide", url: "https://developers.stellar.org/docs/troubleshooting" }
]
```

### retryWithBackoff(fn, maxAttempts, context)
Intelligent retry mechanism with:
- **Exponential Backoff**: Increasing delays between attempts
- **Jitter**: Random delay variation to prevent thundering herd
- **Max Delay Cap**: 30-second maximum delay
- **Category-Specific Delays**: Different base delays for different error types

## Custom Hooks

### useErrorHandler(context)
Comprehensive error handling hook:
```javascript
const { 
  error, 
  isRetrying, 
  retryCount,
  handleError, 
  clearError, 
  retryOperation,
  withErrorHandling 
} = useErrorHandler('ComponentName');
```

### useAsyncOperation(operation, dependencies)
Automatic error handling for async operations:
```javascript
const { 
  data, 
  loading, 
  error, 
  execute, 
  retry, 
  clearError 
} = useAsyncOperation(fetchData, [dependency]);
```

### useFormValidation(validationRules)
Form validation with error handling:
```javascript
const {
  errors,
  touched,
  validate,
  getFieldError,
  hasErrors
} = useFormValidation({
  publicKey: {
    required: true,
    pattern: /^G[A-Z0-9]{55}$/,
    patternMessage: 'Invalid Stellar public key format'
  }
});
```

## Error Reporting Service

### Features
- **Batched Reporting**: Efficient error submission
- **Session Tracking**: Unique session identifiers
- **User Context**: Browser, device, and environment information
- **Breadcrumbs**: User action tracking
- **Deduplication**: Error fingerprinting to prevent spam
- **Local Storage Backup**: Offline error storage
- **Performance Metrics**: Error impact tracking

### Configuration
```javascript
initializeErrorReporting({
  enabled: true,
  maxErrorsPerSession: 100,
  batchSize: 10,
  flushInterval: 30000,
  endpoint: 'https://your-error-service.com/api/errors'
});
```

### Usage Examples
```javascript
// Report errors
reportError(error, { context: 'UserAction', severity: 'high' });

// Add breadcrumbs
addBreadcrumb('User clicked connect button', 'user_action');

// Report warnings
reportWarning('Slow network detected', { latency: 5000 });

// Report performance
reportPerformance('page_load_time', 2500, { page: 'dashboard' });
```

## Error Recovery Strategies

### Automatic Recovery
1. **Network Errors**: Retry with exponential backoff
2. **Rate Limiting**: Wait and retry with appropriate delays
3. **Temporary Failures**: Multiple retry attempts
4. **Timeout Errors**: Retry with increased timeout

### User-Guided Recovery
1. **Validation Errors**: Clear input guidance and examples
2. **Authentication**: Redirect to login or wallet connection
3. **Permission Errors**: Contact support or upgrade prompts
4. **Critical Errors**: Safe fallback states and manual recovery

### Contextual Help
- **Network Issues**: Status page links and troubleshooting guides
- **Stellar Errors**: Developer documentation and common solutions
- **Validation Problems**: Format examples and input guides
- **General Support**: Community forums and help resources

## Implementation Examples

### Basic Error Boundary Usage
```jsx
function MyComponent() {
  return (
    <ErrorBoundary 
      onRetry={() => window.location.reload()} 
      maxRetries={3}
    >
      <StellarAccountViewer />
    </ErrorBoundary>
  );
}
```

### Component-Level Error Handling
```jsx
function AccountLoader({ publicKey }) {
  const { error, loading, execute, retry } = useAsyncOperation(
    () => fetchAccount(publicKey),
    [publicKey]
  );

  if (error) {
    return (
      <ErrorFallback 
        error={error.originalError}
        errorDetails={error}
        resetErrorBoundary={() => window.location.reload()}
        retryWithBackoff={retry}
      />
    );
  }

  // ... rest of component
}
```

### Form Validation with Error Handling
```jsx
function ConnectForm() {
  const { handleError } = useErrorHandler('ConnectForm');
  const { errors, validate, getFieldError } = useFormValidation({
    publicKey: {
      required: 'Public key is required',
      pattern: /^G[A-Z0-9]{55}$/,
      patternMessage: 'Invalid Stellar public key format'
    }
  });

  const handleSubmit = async (values) => {
    try {
      if (!validate(values)) return;
      
      await connectToAccount(values.publicKey);
      addBreadcrumb('Account connected successfully', 'success');
    } catch (error) {
      handleError(error, { publicKey: values.publicKey });
    }
  };

  // ... rest of component
}
```

## Best Practices

### Error Handling
1. **Always categorize errors** for better user experience
2. **Provide contextual help** links for each error type
3. **Use appropriate retry strategies** based on error category
4. **Log detailed context** for debugging
5. **Sanitize sensitive data** before reporting

### User Experience
1. **Show loading states** during retry attempts
2. **Provide clear recovery actions** for each error type
3. **Use progressive disclosure** for technical details
4. **Make error messages actionable** and specific
5. **Offer multiple recovery paths** when possible

### Performance
1. **Batch error reports** to reduce network overhead
2. **Implement circuit breakers** for failing services
3. **Use exponential backoff** to prevent overwhelming servers
4. **Cache error responses** to avoid repeated failures
5. **Monitor error rates** and adjust retry strategies

## Testing Error Scenarios

### Manual Testing
1. **Network Errors**: Disconnect internet, block requests
2. **Validation Errors**: Submit invalid forms
3. **Stellar Errors**: Use invalid public keys, insufficient balances
4. **Rate Limiting**: Make rapid API requests
5. **Authentication**: Test with expired tokens

### Automated Testing
```javascript
// Test error categorization
expect(categorizeError(networkError)).toEqual({
  category: 'network',
  severity: 'high'
});

// Test retry logic
const mockFn = jest.fn()
  .mockRejectedValueOnce(new Error('Network error'))
  .mockResolvedValueOnce('success');

const result = await retryWithBackoff(mockFn, 3);
expect(result).toBe('success');
expect(mockFn).toHaveBeenCalledTimes(2);
```

## Monitoring and Analytics

### Key Metrics
- **Error Rate**: Errors per session/user
- **Error Categories**: Distribution of error types
- **Retry Success Rate**: Effectiveness of retry mechanisms
- **User Recovery Actions**: How users respond to errors
- **Time to Recovery**: How long errors persist

### Dashboards
- **Real-time Error Monitoring**: Live error feeds
- **Error Trends**: Historical error patterns
- **User Impact**: Affected user counts
- **Recovery Metrics**: Success rates and times
- **Performance Impact**: Error effects on app performance

## Integration with External Services

### Sentry Integration
```javascript
initializeErrorReporting({
  endpoint: 'https://your-sentry-dsn.ingest.sentry.io/api/errors',
  beforeSend: (errorReport) => {
    // Custom processing before sending to Sentry
    return errorReport;
  }
});
```

### Custom Analytics
```javascript
// Track error recovery success
addBreadcrumb('Error recovered successfully', 'success', {
  errorCategory: error.category,
  retryCount: 2,
  recoveryTime: Date.now() - errorStartTime
});
```

This enhanced error handling system provides a robust foundation for managing errors in the Stellar Dev Dashboard, ensuring users have a smooth experience even when things go wrong.

## Deterministic Testing for Error Handling

To ensure robust error handling under various edge cases, the Stellar Dev Dashboard leverages **MSW (Mock Service Worker)** for deterministic integration testing. 

The tests are located in `tests/integration/resilience.test.ts` and cover the following scenarios deterministically:
- **Pagination**: Mocks `nextCursor` tokens to verify the application loads multiple pages of data correctly.
- **Rate Limits (HTTP 429)**: Simulates API rate limiting to ensure exponential backoff or retry logic behaves as expected.
- **Malformed XDR (HTTP 400)**: Simulates malformed transactions being rejected by Horizon to verify `tx_bad_seq` and other specific errors.
- **RPC Failures (HTTP 500)**: Overrides Soroban RPC endpoints to trigger internal server errors, validating application stability under node failure.
- **Protocol-version Changes**: Adjusts the mock `horizon_version` to simulate API deprecations and protocol version drifts.

This testing approach guarantees that failure paths, fallback mechanisms, and boundary cases are verified consistently across different testing environments without relying on live network conditions.