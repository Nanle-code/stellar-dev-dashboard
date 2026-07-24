import { ErrorCategory, AppError } from './errorHandling';

export interface RecoverySuggestion {
  title: string;
  description: string;
  action?: () => void | Promise<void>;
  actionLabel?: string;
}

export function getRecoverySuggestions(error: unknown): RecoverySuggestion[] {
  if (error instanceof AppError) {
    return getSuggestionsForCategory(error.category, error);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return getSuggestionsForCategory(ErrorCategory.Network, error);
    }
    if (msg.includes('timeout')) {
      return getSuggestionsForCategory(ErrorCategory.Timeout, error);
    }
  }

  return getDefaultSuggestions();
}

function getSuggestionsForCategory(category: ErrorCategory, error: any): RecoverySuggestion[] {
  const suggestions: Record<ErrorCategory, RecoverySuggestion[]> = {
    [ErrorCategory.Network]: [
      {
        title: 'Check your connection',
        description: 'Ensure you have a stable internet connection',
        actionLabel: 'Retry',
      },
      {
        title: 'Switch network',
        description: 'Try using a different Stellar network (testnet/mainnet)',
      },
      {
        title: 'Check Horizon status',
        description: 'The Stellar Horizon API might be experiencing issues',
      },
    ],
    [ErrorCategory.Validation]: [
      {
        title: 'Review your input',
        description: 'Check that all required fields are filled correctly',
      },
      {
        title: 'Check data format',
        description: 'Ensure dates, amounts, and addresses are in the correct format',
      },
    ],
    [ErrorCategory.Authentication]: [
      {
        title: 'Sign in again',
        description: 'Your session may have expired',
        actionLabel: 'Sign In',
      },
      {
        title: 'Check wallet connection',
        description: 'Ensure your wallet is properly connected',
      },
    ],
    [ErrorCategory.Authorization]: [
      {
        title: 'Check permissions',
        description: 'You may not have access to this resource',
      },
      {
        title: 'Contact administrator',
        description: 'Request access to this feature',
      },
    ],
    [ErrorCategory.NotFound]: [
      {
        title: 'Verify the ID',
        description: 'Check that the account or transaction ID is correct',
      },
      {
        title: 'Check network',
        description: 'Ensure you are on the correct network (testnet/mainnet)',
      },
    ],
    [ErrorCategory.RateLimit]: [
      {
        title: 'Wait before retrying',
        description: 'You have made too many requests. Please wait a moment.',
        actionLabel: 'Retry in 30s',
      },
      {
        title: 'Reduce request frequency',
        description: 'Space out your requests to avoid rate limiting',
      },
    ],
    [ErrorCategory.Timeout]: [
      {
        title: 'Retry the request',
        description: 'The request took too long. Try again.',
        actionLabel: 'Retry',
      },
      {
        title: 'Check network speed',
        description: 'A slow connection may cause timeouts',
      },
    ],
    [ErrorCategory.ServerError]: [
      {
        title: 'Try again later',
        description: 'The server is experiencing issues',
        actionLabel: 'Retry',
      },
      {
        title: 'Check status page',
        description: 'Visit stellar.org/status for updates',
      },
    ],
    [ErrorCategory.Conflict]: [
      {
        title: 'Refresh data',
        description: 'The resource may have been modified',
        actionLabel: 'Refresh',
      },
    ],
    [ErrorCategory.Unknown]: getDefaultSuggestions(),
  };

  return suggestions[category] || getDefaultSuggestions();
}

function getDefaultSuggestions(): RecoverySuggestion[] {
  return [
    {
      title: 'Try again',
      description: 'Retry the operation',
      actionLabel: 'Retry',
    },
    {
      title: 'Refresh the page',
      description: 'Reload the application to reset state',
      actionLabel: 'Refresh',
    },
    {
      title: 'Clear cache',
      description: 'Clear browser cache and try again',
    },
  ];
}

export async function attemptAutoRecovery(error: unknown): Promise<boolean> {
  if (error instanceof AppError) {
    switch (error.category) {
      case ErrorCategory.Network:
      case ErrorCategory.Timeout:
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      case ErrorCategory.RateLimit:
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      default:
        return false;
    }
  }
  return false;
}
