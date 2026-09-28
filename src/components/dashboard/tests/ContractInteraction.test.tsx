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
      parseContractWasm: vi.fn(),
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

  describe('Generated Argument Controls', () => {
    it('generates specific controls based on contract spec and hides manual type selection', async () => {
      // Setup mock to return a function with spec parameters
      const { parseContractWasm } = await import('../../../lib/contractInvoker');
      vi.mocked(parseContractWasm).mockResolvedValueOnce({
        functions: [{
          name: 'update_config',
          parameters: [
            { name: 'enable_flag', type: 'bool' },
            { name: 'threshold', type: 'u32' }
          ]
        }]
      });

      render(<ContractInteraction />);

      const contractIdInput = screen.getByPlaceholderText('C... contract address');
      const functionNameInput = screen.getByPlaceholderText('increment');

      fireEvent.change(contractIdInput, { target: { value: 'C1234567890ABCDEFG' } });
      fireEvent.change(functionNameInput, { target: { value: 'update_config' } });

      await waitFor(() => {
        expect(parseContractWasm).toHaveBeenCalledWith('C1234567890ABCDEFG', 'testnet');
      });

      // The argument types are bool and u32. The manual type selections should not be present for these
      await waitFor(() => {
        expect(screen.queryByDisplayValue('String')).not.toBeInTheDocument();
        expect(screen.getByText('enable_flag')).toBeInTheDocument();
        expect(screen.getByText('threshold')).toBeInTheDocument();
      });

      // Should render a boolean select for enable_flag
      expect(screen.getByRole('combobox', { name: /enable_flag/i })).toBeInTheDocument();
    });

    it('falls back to manual type selection if no spec is available', async () => {
      render(<ContractInteraction />);

      const contractIdInput = screen.getByPlaceholderText('C... contract address');
      const functionNameInput = screen.getByPlaceholderText('increment');

      fireEvent.change(contractIdInput, { target: { value: 'C1234567890ABCDEFG' } });
      fireEvent.change(functionNameInput, { target: { value: 'unknown_func' } });

      // Should render the manual type selection for an ad-hoc argument
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /String/i })).toBeInTheDocument();
      });
    });
  });
});
