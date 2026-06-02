export interface ErrorDetails {
  originalError?: unknown;
  message?: string;
  timestamp?: string | number;
  url?: string;
  userAgent?: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  isRetryable?: boolean;
  userFriendlyMessage?: {
    title: string;
    message: string;
    action: string;
  };
  helpLinks?: Array<{ label: string; url: string }>;
  context?: string;
  [key: string]: unknown;
}
