/**
 * A mock error reporting service.
 * In a real application, this could be integrated with Sentry, LogRocket, etc.
 */

export const reportError = (error, errorInfo = null) => {
  // In production, send this to your error reporting service
  console.error('[Error Reporting Service] Caught error:', error);
  if (errorInfo) {
    console.error('[Error Reporting Service] Error info:', errorInfo);
  }
  
  // Example of simulated network request:
  // fetch('https://api.example.com/logs', {
  //   method: 'POST',
  //   body: JSON.stringify({ error: error.toString(), info: errorInfo }),
  // }).catch(console.error);
};

export const reportWarning = (message, data = null) => {
  console.warn(`[Error Reporting Service - Warning] ${message}`, data);
};
