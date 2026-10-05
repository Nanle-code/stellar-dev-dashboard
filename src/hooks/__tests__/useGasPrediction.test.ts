import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const service = vi.hoisted(() => ({
  predictGas: vi.fn(async () => ({ predictedMinResourceFee: 100 })),
  subscribe: vi.fn(() => () => {}),
  recordActualCost: vi.fn(),
}));

vi.mock('../../lib/gasPredictionService', () => ({
  getGasPredictionService: () => service,
}));

import { useGasPrediction } from '../useGasPrediction';

describe('useGasPrediction', () => {
  beforeEach(() => {
    service.predictGas.mockClear();
    service.subscribe.mockClear();
  });

  it('does not re-run the prediction when callers pass a new but equal args array each render', async () => {
    const { rerender, result } = renderHook(
      ({ value }) =>
        useGasPrediction({
          contractId: 'CABC',
          functionName: 'increment',
          // A fresh array every render, as ContractInteraction does.
          args: [{ type: 'int', value }],
          enabled: true,
        }),
      { initialProps: { value: '1' } }
    );

    await waitFor(() => expect(result.current.prediction).not.toBeNull());
    const calls = service.predictGas.mock.calls.length;

    rerender({ value: '2' }); // same type and length → same prediction input
    rerender({ value: '3' });
    expect(service.predictGas.mock.calls.length).toBe(calls);

    rerender({ value: '42' }); // length changed → predict again
    await waitFor(() => expect(service.predictGas.mock.calls.length).toBe(calls + 1));
  });

  it('stays idle until contract and function are provided', () => {
    renderHook(() => useGasPrediction({ contractId: 'CABC', args: [], enabled: false }));
    expect(service.predictGas).not.toHaveBeenCalled();
  });
});
