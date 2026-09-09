export interface Rule {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  match: (event: ComplianceEvent) => boolean;
  explanation: string;
}

export interface ComplianceEvent {
  accountId: string;
  type: string;
  amount?: number;
  memo?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export const HIGH_RISK_COUNTRIES = ['XYZ', 'ABC', 'FAKE'];

export const defaultRules: Rule[] = [
  {
    id: 'highValueTransfer',
    description: 'Transfers above a high-value threshold',
    severity: 'high',
    match: (event) => !!event.amount && event.amount >= 10000,
    explanation: 'Large outgoing transfer exceeding threshold',
  },
  {
    id: 'rapidTransfers',
    description: 'Many transfers in a short period',
    severity: 'medium',
    match: (event) => {
      const c = event.metadata?.recentTransfersCount ?? 0;
      return c >= 6;
    },
    explanation: 'Multiple transfers in a short timeframe',
  },
  {
    id: 'toHighRiskCountry',
    description: 'Transfer to high-risk jurisdiction',
    severity: 'critical',
    match: (event) => {
      const country = event.metadata?.destinationCountry;
      return typeof country === 'string' && HIGH_RISK_COUNTRIES.includes(country.toUpperCase());
    },
    explanation: 'Destination in high-risk jurisdiction',
  },
  {
    id: 'suspiciousMemo',
    description: 'Suspicious memo patterns',
    severity: 'low',
    match: (event) => {
      const memo = event.memo || '';
      return /(?:loan|kickback|payment for services|invoice\s*#?\d{6,})/i.test(memo);
    },
    explanation: 'Memo text matches suspicious patterns',
  },
];
