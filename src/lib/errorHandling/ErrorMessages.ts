/**
 * ErrorMessages.ts — Issue #144
 * User-friendly error messages keyed by category and context.
 */

export const ERROR_MESSAGES: Record<string, { title: string; message: string; action: string }> = {
  network: {
    title: 'Connection Problem',
    message: 'Unable to reach the Stellar network. Check your internet connection.',
    action: 'Retry Connection',
  },
  validation: {
    title: 'Invalid Input',
    message: 'The information you entered is not valid. Please review and try again.',
    action: 'Fix Input',
  },
  stellar: {
    title: 'Stellar Network Error',
    message: 'A Stellar network operation failed. This may be temporary.',
    action: 'Try Again',
  },
  authentication: {
    title: 'Authentication Required',
    message: 'You need to authenticate to perform this action.',
    action: 'Sign In',
  },
  permission: {
    title: 'Permission Denied',
    message: "You don't have permission to perform this action.",
    action: 'Contact Support',
  },
  rate_limit: {
    title: 'Too Many Requests',
    message: "You're making requests too quickly. Please wait a moment.",
    action: 'Wait and Retry',
  },
  timeout: {
    title: 'Request Timed Out',
    message: 'The request took too long. Please try again.',
    action: 'Retry',
  },
  unknown: {
    title: 'Unexpected Error',
    message: 'Something unexpected happened. Our team has been notified.',
    action: 'Try Again',
  },
}

export function getErrorMessage(category: string) {
  return ERROR_MESSAGES[category] ?? ERROR_MESSAGES.unknown
}

export const STELLAR_ERROR_CODES: Record<string, string> = {
  tx_bad_seq: 'Transaction sequence number is incorrect. Reload and try again.',
  tx_bad_auth: 'Transaction authorization failed. Check your signing key.',
  tx_insufficient_balance: 'Insufficient balance to complete this transaction.',
  tx_no_account: 'Source account does not exist on the network.',
  tx_insufficient_fee: 'Transaction fee is too low. Increase the base fee.',
  op_no_destination: 'Destination account does not exist.',
  op_no_trust: 'Destination account has no trustline for this asset.',
  op_line_full: 'Destination account trustline is at capacity.',
  op_underfunded: 'Insufficient balance for this operation.',
}

export function getStellarErrorMessage(resultCode: string): string {
  return STELLAR_ERROR_CODES[resultCode] ?? `Stellar error: ${resultCode}`
}
