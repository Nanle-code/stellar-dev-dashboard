/**
 * Stellar Error Code Database
 * Comprehensive mapping of Stellar network error codes to plain-language explanations
 */

export interface ErrorExplanation {
  code: string;
  category: string;
  title: string;
  plainExplanation: string;
  technicalDetails: string;
  commonCauses: string[];
  suggestedSolutions: string[];
  relatedDocs: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
}

export const ERROR_DATABASE: Record<string, ErrorExplanation> = {
  // Horizon Transaction Result Codes
  'tx_success': {
    code: 'tx_success',
    category: 'stellar',
    title: 'Transaction Successful',
    plainExplanation: 'Your transaction was successfully processed and included in the Stellar ledger.',
    technicalDetails: 'The transaction was validated by the network and included in a ledger block.',
    commonCauses: [],
    suggestedSolutions: [],
    relatedDocs: ['https://developers.stellar.org/docs/start/list-of-operations/'],
    severity: 'low',
    retryable: false
  },
  'tx_failed': {
    code: 'tx_failed',
    category: 'stellar',
    title: 'Transaction Failed',
    plainExplanation: 'Your transaction could not be completed because one or more operations within it failed.',
    technicalDetails: 'The transaction was submitted but one or more operations failed during validation. Check the operation-level result codes for specific failure reasons.',
    commonCauses: [
      'Insufficient balance for the operation',
      'Invalid destination account',
      'Missing trustline for asset',
      'Sequence number mismatch'
    ],
    suggestedSolutions: [
      'Check each operation\'s result code for specific failure reason',
      'Ensure your account has sufficient XLM balance for fees',
      'Verify destination account exists and is funded',
      'Check trustlines for custom assets'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/'],
    severity: 'high',
    retryable: false
  },
  'tx_too_early': {
    code: 'tx_too_early',
    category: 'stellar',
    title: 'Transaction Too Early',
    plainExplanation: 'Your transaction was submitted before its scheduled start time.',
    technicalDetails: 'The transaction\'s min_time bound is in the future relative to the current ledger time.',
    commonCauses: [
      'Transaction was scheduled for future execution',
      'System clock is out of sync',
      'Incorrect time bounds set'
    ],
    suggestedSolutions: [
      'Wait until the transaction\'s min_time is reached',
      'Remove or adjust time bounds if immediate execution is desired',
      'Check your system clock for accuracy'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/'],
    severity: 'medium',
    retryable: true
  },
  'tx_too_late': {
    code: 'tx_too_late',
    category: 'stellar',
    title: 'Transaction Too Late',
    plainExplanation: 'Your transaction was submitted after its scheduled end time.',
    technicalDetails: 'The transaction\'s max_time bound has passed relative to the current ledger time.',
    commonCauses: [
      'Transaction took too long to submit',
      'Network congestion delayed submission',
      'Max_time was set too short'
    ],
    suggestedSolutions: [
      'Submit a new transaction with updated time bounds',
      'Increase max_time for future transactions',
      'Submit transactions more quickly after signing'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/'],
    severity: 'medium',
    retryable: false
  },
  'tx_bad_seq': {
    code: 'tx_bad_seq',
    category: 'stellar',
    title: 'Bad Sequence Number',
    plainExplanation: 'Your transaction has an incorrect sequence number. Each transaction must have a sequence number exactly one higher than the previous one.',
    technicalDetails: 'The sequence number in the transaction does not match the expected sequence number for the source account. Expected: {expected}, Got: {actual}',
    commonCauses: [
      'Multiple transactions submitted simultaneously',
      'Sequence number not incremented after previous transaction',
      'Account sequence number out of sync'
    ],
    suggestedSolutions: [
      'Fetch the current sequence number from the account',
      'Ensure sequence number is incremented by 1 for each transaction',
      'Wait for previous transaction to complete before submitting next one'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/'],
    severity: 'high',
    retryable: true
  },
  'tx_bad_auth': {
    code: 'tx_bad_auth',
    category: 'stellar',
    title: 'Bad Authentication',
    plainExplanation: 'Your transaction lacks proper signatures or the signature weight is insufficient.',
    technicalDetails: 'The transaction was not properly signed or the signature weight is below the account\'s threshold.',
    commonCauses: [
      'Missing signature from required signer',
      'Signature weight below threshold',
      'Invalid signature format',
      'Multisig account not properly signed'
    ],
    suggestedSolutions: [
      'Ensure all required signers have signed the transaction',
      'Check signature weight meets account threshold',
      'Verify signature format is correct',
      'For multisig accounts, ensure sufficient signers have approved'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/signatures-multisig/'],
    severity: 'high',
    retryable: false
  },
  'tx_insufficient_balance': {
    code: 'tx_insufficient_balance',
    category: 'stellar',
    title: 'Insufficient Balance',
    plainExplanation: 'Your account does not have enough XLM to pay the transaction fee.',
    technicalDetails: 'The source account balance is below the required fee amount. Required: {required} XLM, Available: {available} XLM',
    commonCauses: [
      'Account balance too low for fees',
      'Multiple transactions depleting balance',
      'Fee higher than expected due to network congestion'
    ],
    suggestedSolutions: [
      'Fund your account with more XLM',
      'Wait for network congestion to decrease (lower fees)',
      'Reduce number of operations in transaction'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/fees/'],
    severity: 'high',
    retryable: true
  },
  'tx_insufficient_fee': {
    code: 'tx_insufficient_fee',
    category: 'stellar',
    title: 'Insufficient Fee',
    plainExplanation: 'The fee you offered is too low for the current network conditions.',
    technicalDetails: 'The transaction fee bid is below the current base fee multiplier. Offered: {offered} stroops, Required: {required} stroops',
    commonCauses: [
      'Network congestion increased base fee',
      'Fee set too low initially',
      'High network activity period'
    ],
    suggestedSolutions: [
      'Increase the transaction fee',
      'Wait for network congestion to decrease',
      'Use dynamic fee calculation based on current network conditions'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/fees/'],
    severity: 'medium',
    retryable: true
  },
  'tx_no_account': {
    code: 'tx_no_account',
    category: 'stellar',
    title: 'Account Not Found',
    plainExplanation: 'The source account does not exist on the Stellar network.',
    technicalDetails: 'The account specified as the transaction source has not been created or funded.',
    commonCauses: [
      'Account address is incorrect',
      'Account has never been funded',
      'Account was merged into another account'
    ],
    suggestedSolutions: [
      'Verify the account address is correct',
      'Fund the account with at least 1 XLM to create it',
      'Check if account was merged using account merger operation'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/create-account/'],
    severity: 'critical',
    retryable: false
  },

  // Horizon Operation Result Codes
  'op_success': {
    code: 'op_success',
    category: 'stellar',
    title: 'Operation Successful',
    plainExplanation: 'This operation completed successfully.',
    technicalDetails: 'The operation was validated and executed without errors.',
    commonCauses: [],
    suggestedSolutions: [],
    relatedDocs: ['https://developers.stellar.org/docs/start/list-of-operations/'],
    severity: 'low',
    retryable: false
  },
  'op_no_destination': {
    code: 'op_no_destination',
    category: 'stellar',
    title: 'Destination Account Not Found',
    plainExplanation: 'The destination account does not exist on the Stellar network.',
    technicalDetails: 'The payment operation targeted an account that has not been created or funded.',
    commonCauses: [
      'Destination address is incorrect',
      'Destination account has never been funded',
      'Destination account was merged'
    ],
    suggestedSolutions: [
      'Verify the destination address is correct',
      'Create the destination account first using createAccount operation',
      'Fund the destination account with at least 1 XLM'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/create-account/'],
    severity: 'high',
    retryable: false
  },
  'op_no_trust': {
    code: 'op_no_trust',
    category: 'stellar',
    title: 'No Trustline',
    plainExplanation: 'The destination account does not have a trustline for this asset.',
    technicalDetails: 'The recipient must establish a trustline for the asset before receiving it.',
    commonCauses: [
      'Recipient has not created trustline for this asset',
      'Asset issuer requires authorization',
      'Trustline was removed'
    ],
    suggestedSolutions: [
      'Ask recipient to create a trustline for this asset',
      'Contact asset issuer if authorization is required',
      'Use a different asset that recipient already trusts'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/assets/'],
    severity: 'high',
    retryable: false
  },
  'op_underfunded': {
    code: 'op_underfunded',
    category: 'stellar',
    title: 'Insufficient Funds',
    plainExplanation: 'The source account does not have enough balance for this operation.',
    technicalDetails: 'The account balance is insufficient to complete the transfer. Required: {required}, Available: {available}',
    commonCauses: [
      'Account balance too low',
      'Multiple pending transactions',
      'Asset balance insufficient'
    ],
    suggestedSolutions: [
      'Fund your account with more of the required asset',
      'Reduce the transfer amount',
      'Wait for pending transactions to complete'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/payment/'],
    severity: 'high',
    retryable: true
  },
  'op_low_reserve': {
    code: 'op_low_reserve',
    category: 'stellar',
    title: 'Low Reserve',
    plainExplanation: 'This operation would drop your account below the minimum balance requirement.',
    technicalDetails: 'Stellar accounts must maintain a minimum reserve of 2 XLM plus 0.5 XLM for each subentry (trustlines, signers, etc.).',
    commonCauses: [
      'Account balance close to minimum reserve',
      'Creating additional trustlines or signers',
      'Sending too much XLM'
    ],
    suggestedSolutions: [
      'Fund your account with more XLM',
      'Remove unused trustlines to reduce reserve requirement',
      'Reduce the amount being sent'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/fees/'],
    severity: 'high',
    retryable: false
  },
  'op_src_not_authorized': {
    code: 'op_src_not_authorized',
    category: 'stellar',
    title: 'Source Not Authorized',
    plainExplanation: 'The source account is not authorized to hold this asset.',
    technicalDetails: 'The asset issuer has enabled authorization requirements and has not approved this account.',
    commonCauses: [
      'Asset issuer requires authorization',
      'Account not approved by issuer',
      'Authorization was revoked'
    ],
    suggestedSolutions: [
      'Contact the asset issuer to request authorization',
      'Use a different asset that does not require authorization',
      'Check if authorization was revoked'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/assets/'],
    severity: 'high',
    retryable: false
  },
  'op_line_full': {
    code: 'op_line_full',
    category: 'stellar',
    title: 'Trustline Full',
    plainExplanation: 'The trustline limit has been reached for this asset.',
    technicalDetails: 'The amount being received would exceed the trustline limit set for this asset.',
    commonCauses: [
      'Trustline limit set too low',
      'Large payment exceeding limit',
      'Multiple payments accumulating'
    ],
    suggestedSolutions: [
      'Increase the trustline limit for this asset',
      'Reduce the payment amount',
      'Remove some of the asset balance first'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/assets/'],
    severity: 'medium',
    retryable: false
  },
  'op_no_issuer': {
    code: 'op_no_issuer',
    category: 'stellar',
    title: 'Issuer Not Found',
    plainExplanation: 'The asset issuer account does not exist.',
    technicalDetails: 'The asset issuer account has not been created or has been merged.',
    commonCauses: [
      'Issuer account never created',
      'Issuer account was merged',
      'Incorrect issuer address'
    ],
    suggestedSolutions: [
      'Verify the issuer address is correct',
      'Contact the asset issuer',
      'Use a different asset with a valid issuer'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/assets/'],
    severity: 'critical',
    retryable: false
  },

  // HTTP Status Codes
  '400': {
    code: '400',
    category: 'validation',
    title: 'Bad Request',
    plainExplanation: 'The request was invalid or malformed.',
    technicalDetails: 'HTTP 400 - The server could not understand the request due to invalid syntax or missing parameters.',
    commonCauses: [
      'Invalid parameters in request',
      'Malformed transaction XDR',
      'Missing required fields'
    ],
    suggestedSolutions: [
      'Check request parameters for correctness',
      'Validate transaction XDR format',
      'Ensure all required fields are included'
    ],
    relatedDocs: ['https://developers.stellar.org/api/horizon/resources/'],
    severity: 'medium',
    retryable: false
  },
  '401': {
    code: '401',
    category: 'authentication',
    title: 'Unauthorized',
    plainExplanation: 'Authentication is required to perform this action.',
    technicalDetails: 'HTTP 401 - The request requires valid authentication credentials.',
    commonCauses: [
      'Wallet not connected',
      'Authentication token expired',
      'Invalid credentials'
    ],
    suggestedSolutions: [
      'Connect your wallet',
      'Refresh your authentication',
      'Check your credentials'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/wallet-integration/'],
    severity: 'high',
    retryable: false
  },
  '403': {
    code: '403',
    category: 'permission',
    title: 'Forbidden',
    plainExplanation: 'You do not have permission to perform this action.',
    technicalDetails: 'HTTP 403 - The server understood the request but refuses to authorize it.',
    commonCauses: [
      'Insufficient permissions',
      'Account restrictions',
      'Resource access denied'
    ],
    suggestedSolutions: [
      'Check your account permissions',
      'Contact support for access',
      'Verify you have the required authorizations'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/signatures-multisig/'],
    severity: 'high',
    retryable: false
  },
  '404': {
    code: '404',
    category: 'stellar',
    title: 'Not Found',
    plainExplanation: 'The requested resource was not found.',
    technicalDetails: 'HTTP 404 - The server cannot find the requested resource (account, transaction, etc.).',
    commonCauses: [
      'Account does not exist',
      'Transaction hash is invalid',
      'Resource was deleted'
    ],
    suggestedSolutions: [
      'Verify the account address or transaction hash',
      'Check if the account has been created/funded',
      'Ensure the resource exists'
    ],
    relatedDocs: ['https://developers.stellar.org/api/horizon/resources/'],
    severity: 'medium',
    retryable: false
  },
  '409': {
    code: '409',
    category: 'stellar',
    title: 'Conflict',
    plainExplanation: 'There is a conflict with the current state of the resource.',
    technicalDetails: 'HTTP 409 - The request conflicts with the current state, such as sequence number gaps.',
    commonCauses: [
      'Sequence number mismatch',
      'State conflict',
      'Duplicate transaction'
    ],
    suggestedSolutions: [
      'Fetch the current sequence number',
      'Resubmit with correct sequence',
      'Check for duplicate transactions'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/'],
    severity: 'medium',
    retryable: true
  },
  '429': {
    code: '429',
    category: 'rate_limit',
    title: 'Too Many Requests',
    plainExplanation: 'You have exceeded the rate limit for API requests.',
    technicalDetails: 'HTTP 429 - The API rate limit has been exceeded. Please wait before making more requests.',
    commonCauses: [
      'Too many requests in short time',
      'API quota exceeded',
      'Rapid repeated requests'
    ],
    suggestedSolutions: [
      'Wait a few seconds before retrying',
      'Reduce request frequency',
      'Implement exponential backoff'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/data/horizon/api-reference/rate-limiting/'],
    severity: 'medium',
    retryable: true
  },
  '500': {
    code: '500',
    category: 'network',
    title: 'Internal Server Error',
    plainExplanation: 'The Stellar server encountered an unexpected error.',
    technicalDetails: 'HTTP 500 - The server encountered an unexpected condition that prevented it from fulfilling the request.',
    commonCauses: [
      'Server internal error',
      'Database issue',
      'Temporary server problem'
    ],
    suggestedSolutions: [
      'Wait a moment and retry',
      'Check Stellar network status',
      'Report the issue if it persists'
    ],
    relatedDocs: ['https://status.stellar.org/'],
    severity: 'high',
    retryable: true
  },
  '502': {
    code: '502',
    category: 'network',
    title: 'Bad Gateway',
    plainExplanation: 'The server received an invalid response from an upstream server.',
    technicalDetails: 'HTTP 502 - The gateway server failed to communicate with the Stellar core node.',
    commonCauses: [
      'Upstream server issue',
      'Network connectivity problem',
      'Core node temporarily unavailable'
    ],
    suggestedSolutions: [
      'Wait and retry the request',
      'Check network connectivity',
      'Verify Stellar network status'
    ],
    relatedDocs: ['https://status.stellar.org/'],
    severity: 'high',
    retryable: true
  },
  '503': {
    code: '503',
    category: 'network',
    title: 'Service Unavailable',
    plainExplanation: 'The Stellar service is temporarily unavailable.',
    technicalDetails: 'HTTP 503 - The server is currently unable to handle the request due to maintenance or overload.',
    commonCauses: [
      'Scheduled maintenance',
      'Server overload',
      'Temporary service outage'
    ],
    suggestedSolutions: [
      'Wait a few minutes and retry',
      'Check status page for maintenance announcements',
      'Reduce request load during peak times'
    ],
    relatedDocs: ['https://status.stellar.org/'],
    severity: 'high',
    retryable: true
  },
  '504': {
    code: '504',
    category: 'network',
    title: 'Gateway Timeout',
    plainExplanation: 'The request took too long to process.',
    technicalDetails: 'HTTP 504 - The gateway server did not receive a timely response from the upstream server.',
    commonCauses: [
      'Request processing timeout',
      'Network latency',
      'Server overload'
    ],
    suggestedSolutions: [
      'Retry the request',
      'Check network connectivity',
      'Reduce request complexity'
    ],
    relatedDocs: ['https://status.stellar.org/'],
    severity: 'medium',
    retryable: true
  },

  // Network Errors
  'network_error': {
    code: 'network_error',
    category: 'network',
    title: 'Network Connection Failed',
    plainExplanation: 'Unable to connect to the Stellar network.',
    technicalDetails: 'Network connection failed due to connectivity issues or CORS restrictions.',
    commonCauses: [
      'Internet connection lost',
      'CORS blocking the request',
      'DNS resolution failure'
    ],
    suggestedSolutions: [
      'Check your internet connection',
      'Verify CORS settings if running locally',
      'Try a different network'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/troubleshooting/'],
    severity: 'high',
    retryable: true
  },
  'timeout': {
    code: 'timeout',
    category: 'network',
    title: 'Request Timeout',
    plainExplanation: 'The request took too long to complete.',
    technicalDetails: 'The request exceeded the timeout limit and was cancelled.',
    commonCauses: [
      'Slow network connection',
      'Server response time too long',
      'Complex transaction processing'
    ],
    suggestedSolutions: [
      'Check your network connection',
      'Increase timeout duration',
      'Reduce transaction complexity'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/troubleshooting/'],
    severity: 'medium',
    retryable: true
  },

  // Soroban RPC Errors
  '-32600': {
    code: '-32600',
    category: 'validation',
    title: 'Invalid JSON-RPC Request',
    plainExplanation: 'The JSON-RPC request format is invalid.',
    technicalDetails: 'JSON-RPC error -32600: The JSON sent is not a valid Request object.',
    commonCauses: [
      'Malformed JSON',
      'Invalid JSON-RPC structure',
      'Missing required fields'
    ],
    suggestedSolutions: [
      'Validate JSON format',
      'Check JSON-RPC specification',
      'Ensure all required fields are present'
    ],
    relatedDocs: ['https://www.jsonrpc.org/specification'],
    severity: 'medium',
    retryable: false
  },
  '-32601': {
    code: '-32601',
    category: 'validation',
    title: 'Method Not Found',
    plainExplanation: 'The requested JSON-RPC method does not exist.',
    technicalDetails: 'JSON-RPC error -32601: The method does not exist or is not available.',
    commonCauses: [
      'Typo in method name',
      'Method not supported',
      'Using wrong RPC version'
    ],
    suggestedSolutions: [
      'Check method name spelling',
      'Verify method is supported',
      'Check RPC documentation'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'medium',
    retryable: false
  },
  '-32602': {
    code: '-32602',
    category: 'validation',
    title: 'Invalid Params',
    plainExplanation: 'The method parameters are invalid.',
    technicalDetails: 'JSON-RPC error -32602: Invalid method parameters were provided.',
    commonCauses: [
      'Wrong parameter types',
      'Missing required parameters',
      'Invalid parameter values'
    ],
    suggestedSolutions: [
      'Check parameter types',
      'Ensure all required parameters are provided',
      'Validate parameter values'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'medium',
    retryable: false
  },
  '-32603': {
    code: '-32603',
    category: 'network',
    title: 'Internal JSON-RPC Error',
    plainExplanation: 'The JSON-RPC server encountered an internal error.',
    technicalDetails: 'JSON-RPC error -32603: Internal error on the server side.',
    commonCauses: [
      'Server internal error',
      'Database issue',
      'Unexpected server condition'
    ],
    suggestedSolutions: [
      'Wait and retry',
      'Check Soroban RPC status',
      'Report if issue persists'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'high',
    retryable: true
  },
  '-32001': {
    code: '-32001',
    category: 'stellar',
    title: 'Action Failed',
    plainExplanation: 'The requested action could not be completed.',
    technicalDetails: 'JSON-RPC error -32001: The requested action failed during execution.',
    commonCauses: [
      'Contract execution failed',
      'Invalid operation',
      'Resource constraint'
    ],
    suggestedSolutions: [
      'Check contract logic',
      'Verify operation validity',
      'Check resource limits'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'high',
    retryable: false
  },
  '-32002': {
    code: '-32002',
    category: 'stellar',
    title: 'Contract Code Malformed',
    plainExplanation: 'The contract bytecode failed to load or verify.',
    technicalDetails: 'JSON-RPC error -32002: The contract Wasm bytecode is invalid or corrupted.',
    commonCauses: [
      'Invalid Wasm bytecode',
      'Corrupted contract code',
      'Unsupported Wasm features'
    ],
    suggestedSolutions: [
      'Recompile the contract',
      'Verify Wasm bytecode',
      'Check for unsupported features'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'critical',
    retryable: false
  },

  // Common Error Messages
  'account not found': {
    code: 'account not found',
    category: 'stellar',
    title: 'Account Not Found',
    plainExplanation: 'The specified account does not exist on the Stellar network.',
    technicalDetails: 'The account address has not been created or funded on the network.',
    commonCauses: [
      'Account never funded',
      'Incorrect account address',
      'Account was merged'
    ],
    suggestedSolutions: [
      'Verify the account address is correct',
      'Fund the account with at least 1 XLM',
      'Check if account was merged'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/create-account/'],
    severity: 'high',
    retryable: false
  },
  'invalid public key': {
    code: 'invalid public key',
    category: 'validation',
    title: 'Invalid Public Key',
    plainExplanation: 'The Stellar public key format is invalid.',
    technicalDetails: 'Public keys must start with \'G\' followed by 56 alphanumeric characters (base32).',
    commonCauses: [
      'Incorrect public key format',
      'Typo in public key',
      'Wrong key type (secret key instead of public key)'
    ],
    suggestedSolutions: [
      'Verify public key starts with \'G\'',
      'Ensure public key has 56 characters after \'G\'',
      'Double-check for typos'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/public-key-cryptography/'],
    severity: 'low',
    retryable: false
  },
  'insufficient balance': {
    code: 'insufficient balance',
    category: 'stellar',
    title: 'Insufficient Balance',
    plainExplanation: 'Your account does not have enough balance for this operation.',
    technicalDetails: 'The account balance is below the required amount for the operation.',
    commonCauses: [
      'Account balance too low',
      'Multiple pending transactions',
      'Fee higher than expected'
    ],
    suggestedSolutions: [
      'Fund your account with more assets',
      'Reduce operation amount',
      'Wait for pending transactions'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/transactions/payment/'],
    severity: 'high',
    retryable: true
  },
  'horizon server': {
    code: 'horizon server',
    category: 'network',
    title: 'Horizon Server Error',
    plainExplanation: 'There was an error communicating with the Horizon server.',
    technicalDetails: 'The Horizon API server encountered an error or is unavailable.',
    commonCauses: [
      'Horizon server down',
      'Network connectivity issue',
      'Server maintenance'
    ],
    suggestedSolutions: [
      'Check Stellar network status',
      'Verify network connectivity',
      'Wait and retry'
    ],
    relatedDocs: ['https://status.stellar.org/'],
    severity: 'high',
    retryable: true
  },
  'soroban rpc': {
    code: 'soroban rpc',
    category: 'network',
    title: 'Soroban RPC Error',
    plainExplanation: 'There was an error communicating with the Soroban RPC server.',
    technicalDetails: 'The Soroban RPC server encountered an error or is unavailable.',
    commonCauses: [
      'RPC server down',
      'Network connectivity issue',
      'Invalid RPC request'
    ],
    suggestedSolutions: [
      'Check Soroban RPC status',
      'Verify network connectivity',
      'Validate RPC request format'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/developing/soroban-rpc/'],
    severity: 'high',
    retryable: true
  },
  'rate limit': {
    code: 'rate limit',
    category: 'rate_limit',
    title: 'Rate Limit Exceeded',
    plainExplanation: 'You have exceeded the API rate limit.',
    technicalDetails: 'Too many requests were made in a short period of time.',
    commonCauses: [
      'Too many rapid requests',
      'API quota exceeded',
      'High request frequency'
    ],
    suggestedSolutions: [
      'Wait before retrying',
      'Reduce request frequency',
      'Implement rate limiting'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/data/horizon/api-reference/rate-limiting/'],
    severity: 'medium',
    retryable: true
  },
  'unauthorized': {
    code: 'unauthorized',
    category: 'authentication',
    title: 'Unauthorized',
    plainExplanation: 'Authentication is required for this action.',
    technicalDetails: 'The request requires valid authentication credentials.',
    commonCauses: [
      'Not authenticated',
      'Invalid credentials',
      'Session expired'
    ],
    suggestedSolutions: [
      'Authenticate with your wallet',
      'Refresh your session',
      'Check credentials'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/building-apps/wallet-integration/'],
    severity: 'high',
    retryable: false
  },
  'forbidden': {
    code: 'forbidden',
    category: 'permission',
    title: 'Forbidden',
    plainExplanation: 'You do not have permission to perform this action.',
    technicalDetails: 'The request was understood but access is denied.',
    commonCauses: [
      'Insufficient permissions',
      'Account restrictions',
      'Access denied'
    ],
    suggestedSolutions: [
      'Check account permissions',
      'Contact support',
      'Verify authorizations'
    ],
    relatedDocs: ['https://developers.stellar.org/docs/encyclopedia/signatures-multisig/'],
    severity: 'high',
    retryable: false
  }
};

/**
 * Get error explanation by code
 */
export function getErrorExplanation(code: string): ErrorExplanation | null {
  return ERROR_DATABASE[code] || null;
}

/**
 * Search error explanations by keyword
 */
export function searchErrorExplanations(keyword: string): ErrorExplanation[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(ERROR_DATABASE).filter(explanation =>
    explanation.code.toLowerCase().includes(lowerKeyword) ||
    explanation.title.toLowerCase().includes(lowerKeyword) ||
    explanation.plainExplanation.toLowerCase().includes(lowerKeyword) ||
    explanation.commonCauses.some(cause => cause.toLowerCase().includes(lowerKeyword))
  );
}

/**
 * Get all error explanations by category
 */
export function getErrorsByCategory(category: string): ErrorExplanation[] {
  return Object.values(ERROR_DATABASE).filter(explanation =>
    explanation.category === category
  );
}

/**
 * Get all error codes
 */
export function getAllErrorCodes(): string[] {
  return Object.keys(ERROR_DATABASE);
}
