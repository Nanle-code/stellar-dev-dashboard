import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ResourceMetrics from '../../../../src/components/dashboard/ResourceMetrics';
import * as sorobanLimits from '../../../../src/lib/sorobanLimits';

vi.mock('../../../../src/lib/sorobanLimits', () => ({
  fetchNetworkLimits: vi.fn(),
  DEFAULT_SOROBAN_LIMITS: {
    cpuInstructions: 100000000,
    memoryBytes: 40000000,
    readEntries: 40,
    writeEntries: 25,
    readBytes: 100000,
    writeBytes: 65000,
    eventsSize: 10000,
    txSize: 100000,
  }
}));

describe('ResourceMetrics', () => {
  beforeEach(() => {
    vi.mocked(sorobanLimits.fetchNetworkLimits).mockResolvedValue(sorobanLimits.DEFAULT_SOROBAN_LIMITS);
  });

  it('renders primary flow correctly', async () => {
    render(<ResourceMetrics 
      cost={{ cpuInstructions: 50000000, memoryBytes: 20000000 }} 
      footprint={{ minResourceFee: '1000', readOnly: [], readWrite: [] }} 
      network="testnet" 
      inclusionFee={100} 
    />);
    
    await waitFor(() => {
      expect(screen.getByText('Resource Usage & Limits')).toBeInTheDocument();
      // Should show CPU Instructions as 50,000,000 / 100,000,000
      expect(screen.getByText(/50,000,000 \/ 100,000,000/)).toBeInTheDocument();
      // Total fee should be 1100 (1000 minResourceFee + 100 inclusionFee)
      expect(screen.getByText(/1,100 stroops/)).toBeInTheDocument();
    });
  });

  it('warns at boundary case (>= 80% limit)', async () => {
    render(<ResourceMetrics 
      cost={{ cpuInstructions: 80000000, memoryBytes: 5000000 }} 
      footprint={{ minResourceFee: '1000', readOnly: [], readWrite: [] }} 
      network="testnet" 
      inclusionFee={100} 
    />);
    
    await waitFor(() => {
      expect(screen.getByText('Approaching network limit.')).toBeInTheDocument();
      expect(screen.getByText(/80,000,000 \/ 100,000,000/)).toBeInTheDocument();
    });
  });

  it('handles failure case gracefully (no cost data)', async () => {
    render(<ResourceMetrics 
      cost={null} 
      footprint={null} 
      network="testnet" 
      inclusionFee={100} 
    />);
    
    await waitFor(() => {
      expect(screen.getByText(/0 \/ 100,000,000/)).toBeInTheDocument(); // CPU defaults to 0
      expect(screen.getByText(/100 stroops/)).toBeInTheDocument(); // Total fee = 100 + 0
    });
  });
});
