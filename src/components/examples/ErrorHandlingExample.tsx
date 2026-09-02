import React, { useState } from 'react';
import { useErrorHandler, useAsyncOperation, useFormValidation } from '../../hooks/useErrorHandler';
import { addBreadcrumb } from '../../lib/errorReporting';
import ErrorBoundary from '../ErrorBoundary';

/**
 * Example component demonstrating the enhanced error handling system
 */
function ErrorHandlingExample() {
  const [publicKey, setPublicKey] = useState('');
  const { handleError } = useErrorHandler('ErrorHandlingExample');

  // Form validation example
  const { errors, validate, getFieldError, setFieldTouched } = useFormValidation({
    publicKey: {
      required: 'Public key is required',
      pattern: /^G[A-Z0-9]{55}$/,
      patternMessage: 'Invalid Stellar public key format (must start with G and be 56 characters)'
    }
  });

  // Async operation with automatic error handling
  const { 
    data: accountData, 
    loading, 
    error, 
    execute: fetchAccount, 
    retry 
  } = useAsyncOperation(async (key) => {
    addBreadcrumb('Fetching account data', 'api_call', { publicKey: key });
    
    // Simulate different types of errors for demonstration
    const random = Math.random();
    if (random < 0.3) {
      throw new Error('Account not found on Stellar network');
    } else if (random < 0.5) {
      const networkError = new Error('Network connection failed');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    } else if (random < 0.7) {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.response = { status: 429 };
      throw rateLimitError;
    }
    
    // Simulate successful response
    return {
      id: key,
      sequence: '123456789',
      balances: [
        { asset_type: 'native', balance: '1000.0000000' }
      ]
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const values = { publicKey };
      
      if (!validate(values)) {
        addBreadcrumb('Form validation failed', 'validation_error', { errors });
        return;
      }

      await fetchAccount(publicKey);
      addBreadcrumb('Account fetched successfully', 'success');
    } catch (error) {
      handleError(error, { publicKey, formData: { publicKey } });
    }
  };

  // Simulate component-level error
  const triggerComponentError = () => {
    addBreadcrumb('User triggered component error', 'user_action');
    throw new Error('Simulated component error for testing error boundary');
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '600px',
      margin: '0 auto',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '20px',
        fontWeight: 700,
        marginBottom: '16px',
        color: 'var(--text-primary)'
      }}>
        Error Handling Demo
      </h2>

      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: '24px',
        fontSize: '14px',
        lineHeight: 1.5
      }}>
        This component demonstrates the enhanced error handling system with automatic retry, 
        error categorization, and user-friendly recovery options.
      </p>

      <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px'
          }}>
            Stellar Public Key
          </label>
          <input
            type="text"
            value={publicKey}
            onChange={(e) => {
              setPublicKey(e.target.value);
              setFieldTouched('publicKey');
            }}
            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${getFieldError('publicKey') ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)'
            }}
          />
          {getFieldError('publicKey') && (
            <div style={{
              color: 'var(--red)',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              {getFieldError('publicKey')}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? 'var(--bg-hover)' : 'var(--cyan)',
            color: loading ? 'var(--text-muted)' : 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'var(--transition)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {loading && <div className="spinner" style={{ width: '16px', height: '16px' }} />}
          {loading ? 'Fetching Account...' : 'Fetch Account'}
        </button>
      </form>

      {/* Results Display */}
      {accountData && (
        <div style={{
          padding: '16px',
          background: 'var(--green-glow)',
          border: '1px solid var(--green)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px'
        }}>
          <h3 style={{
            color: 'var(--green)',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            ✓ Account Found
          </h3>
          <pre style={{
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            margin: 0,
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(accountData, null, 2)}
          </pre>
        </div>
      )}

      {/* Error Display with Retry */}
      {error && (
        <div style={{
          padding: '16px',
          background: 'var(--red-glow)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px'
        }}>
          <h3 style={{
            color: 'var(--red)',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            Error: {error.userFriendlyMessage?.title || 'Something went wrong'}
          </h3>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            marginBottom: '12px'
          }}>
            {error.userFriendlyMessage?.message || error.message}
          </p>
          
          {error.isRetryable && (
            <button
              onClick={retry}
              style={{
                padding: '8px 16px',
                background: 'var(--red)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              🔄 Retry
            </button>
          )}

          {error.helpLinks?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Help Resources:
              </div>
              {error.helpLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--cyan)',
                    fontSize: '12px',
                    textDecoration: 'none',
                    marginRight: '12px'
                  }}
                >
                  📖 {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Error Boundary */}
      <div style={{
        padding: '16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '8px',
          color: 'var(--text-primary)'
        }}>
          Test Error Boundary
        </h3>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '12px'
        }}>
          Click the button below to trigger a component error and see the error boundary in action.
        </p>
        <button
          onClick={triggerComponentError}
          style={{
            padding: '8px 16px',
            background: 'var(--amber)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ⚠️ Trigger Error
        </button>
      </div>
    </div>
  );
}

// Wrap the example in an error boundary
export default function ErrorHandlingExampleWithBoundary() {
  return (
    <ErrorBoundary maxRetries={2}>
      <ErrorHandlingExample />
    </ErrorBoundary>
  );
}