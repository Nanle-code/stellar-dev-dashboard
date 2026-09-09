import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

const updateMock = vi.fn();
const getContractInteractionsMock = vi.fn();
const addContractInteractionMock = vi.fn();
const invokeContractFunctionMock = vi.fn();
const simulateContractCallMock = vi.fn();
const isValidContractIdMock = vi.fn(() => true);

let ContractInteraction: React.ComponentType<any>;

const getUsePreferencesMock = () => ({
  preferences: {
    advanced: {
      enableContractAssistant: true,
      someOtherPreference: 'value',
    },
  },
  update: updateMock,
  loading: false,
});

const historyItem = {
  id: 'history-1',
  timestamp: Date.now(),
  network: 'testnet',
  type: 'invoke',
  status: 'success',
  contractId: 'C1234567890ABCDEFG',
  functionName: 'transfer',
  args: [
    { type: 'string', value: 'alice' },
    { type: 'int', value: '100' },
  ],
  sourceAccount: 'GABCDEF1234567890',
  result: { success: true },
};

describe('<ContractInteraction />', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    cleanup();

    vi.doMock('../../../hooks/usePreferences', () => ({
      usePreferences: getUsePreferencesMock,
    }));

    vi.doMock('../../../lib/store', () => ({
      useStore: () => ({ connectedAddress: 'GABCDEF1234567890', network: 'testnet' }),
    }));

    vi.doMock('../../../lib/storage', () => ({
      getContractInteractions: getContractInteractionsMock,
      addContractInteraction: addContractInteractionMock,
    }));

    vi.doMock('../../../lib/contractInvoker', () => ({
      invokeContractFunction: invokeContractFunctionMock,
    }));

    vi.doMock('../../../lib/stellar', () => ({
      simulateContractCall: simulateContractCallMock,
      isValidContractId: isValidContractIdMock,
    }));

    getContractInteractionsMock.mockResolvedValue([historyItem]);

    const module = await import('../ContractInteraction');
    ContractInteraction = module.default;
  });

  afterEach(() => {
    vi.resetModules();
    cleanup();
  });

  it('renders the assistant panel and shows history-based guidance for matching calls', async () => {
    render(<ContractInteraction />);

    expect(screen.getByText('Contract Interaction')).toBeInTheDocument();
    expect(screen.getByText('AI Contract Assistant')).toBeInTheDocument();

    const contractIdInput = screen.getByPlaceholderText('C... contract address');
    const functionNameInput = screen.getByPlaceholderText('increment');

    await waitFor(() => expect(getContractInteractionsMock).toHaveBeenCalled());

    fireEvent.change(contractIdInput, { target: { value: 'C1234567890ABCDEFG' } });
    fireEvent.change(functionNameInput, { target: { value: 'transfer' } });

    await waitFor(() => {
      expect(
        screen.getByText(/Last successful call used string:alice, int:100/)
      ).toBeInTheDocument();
    });
  });

  it('calls update to disable the assistant when the button is clicked', async () => {
    render(<ContractInteraction />);

    await waitFor(() => expect(getContractInteractionsMock).toHaveBeenCalled());

    const disableButton = screen.getByRole('button', { name: /Disable Assistant/i });
    fireEvent.click(disableButton);

    expect(updateMock).toHaveBeenCalledWith('advanced', {
      enableContractAssistant: false,
      someOtherPreference: 'value',
    });
  });
});
