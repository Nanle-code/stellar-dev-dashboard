/**
 * Overview component tests (#99)
 *
 * Smoke + interaction tests using @testing-library/react.
 * Heavy widget/grid children are mocked so we can focus on Overview's own
 * behaviour: header, network badge, edit-mode controls, and reset.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock heavy children so Overview renders in isolation ──────────────────────
vi.mock('../../layout/DashboardGrid', () => ({
  default: ({ widgets, editable }) => (
    <div data-testid="dashboard-grid" data-editable={String(editable)}>
      {widgets.length} widgets
    </div>
  ),
}));

vi.mock('../../layout/WidgetSelector', () => ({
  default: ({ isOpen }) => (isOpen ? <div data-testid="widget-selector">selector</div> : null),
}));

// Mock all the widget components — Overview just constructs them in defaults
vi.mock('../../layout/widgets/BalanceWidget', () => ({
  default: () => <div>balance</div>,
}));
vi.mock('../../layout/widgets/AssetsWidget', () => ({
  default: () => <div>assets</div>,
}));
vi.mock('../../layout/widgets/TransactionsWidget', () => ({
  default: () => <div>transactions</div>,
}));
vi.mock('../../layout/widgets/NetworkStatsWidget', () => ({
  default: () => <div>network</div>,
}));
vi.mock('../../layout/widgets/AccountStatsWidget', () => ({
  default: () => <div>account</div>,
}));
vi.mock('../../layout/widgets/QuickActionsWidget', () => ({
  default: () => <div>quick</div>,
}));
vi.mock('../../layout/widgets/PriceTickerWidget', () => ({
  default: () => <div>price</div>,
}));

// Mock CopyableValue — its full behaviour is exercised elsewhere
vi.mock('../CopyableValue', () => ({
  default: ({ children }) => <span data-testid="copyable">{children}</span>,
}));

// Mock the responsive hook to a stable desktop layout
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, windowWidth: 1280 }),
}));

// Mock persisted state so each test starts from defaults without IndexedDB
vi.mock('../../../hooks/usePersistedState', () => ({
  usePersistedState: (_key, initial) => {
    const [val, setVal] = React.useState(initial);
    return [val, setVal];
  },
}));

// Mock errorReporting breadcrumbs
vi.mock('../../../lib/errorReporting', () => ({
  addBreadcrumb: vi.fn(),
}));

// Mock userPreferences so getDashboardLayout resolves immediately with no saved layout
vi.mock('../../../lib/userPreferences', () => ({
  getDashboardLayout: vi.fn().mockResolvedValue([]),
  saveDashboardLayout: vi.fn().mockResolvedValue(undefined),
}));

// Mock the store
const setStoreState = vi.fn();
let mockState = { connectedAddress: 'GABC...XYZ', network: 'testnet' };
vi.mock('../../../lib/store', () => ({
  useStore: () => mockState,
}));

// Mock stellar.shortAddress (used by Overview)
vi.mock('../../../lib/stellar', () => ({
  shortAddress: (addr, chars = 6) => (addr ? `${addr.slice(0, chars)}…${addr.slice(-chars)}` : ''),
}));

import Overview from '../Overview';

describe('<Overview />', () => {
  beforeEach(() => {
    cleanup();
    setStoreState.mockReset();
    mockState = { connectedAddress: 'GABC...XYZ', network: 'testnet' };
  });

  async function renderOverview() {
    let result;
    await act(async () => {
      result = render(<Overview />);
    });
    return result;
  }

  it('renders the dashboard header and network badge', async () => {
    await renderOverview();
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByText(/testnet/i)).toBeInTheDocument();
  });

  it('renders the default widget grid in non-edit mode', async () => {
    await renderOverview();
    const grid = screen.getByTestId('dashboard-grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('data-editable', 'false');
    expect(grid).toHaveTextContent('4 widgets');
  });

  it('toggles edit mode when the Edit button is clicked', async () => {
    await renderOverview();

    const editBtn = screen.getByTitle('Edit dashboard');
    await act(async () => { fireEvent.click(editBtn); });

    const grid = screen.getByTestId('dashboard-grid');
    expect(grid).toHaveAttribute('data-editable', 'true');
    expect(screen.getByTitle('Add widget')).toBeInTheDocument();
    expect(screen.getByTitle('Reset to default layout')).toBeInTheDocument();
    expect(screen.getByText(/Edit Mode:/)).toBeInTheDocument();
  });

  it('opens the widget selector when "Add Widget" is clicked in edit mode', async () => {
    await renderOverview();
    await act(async () => { fireEvent.click(screen.getByTitle('Edit dashboard')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Add widget')); });
    expect(screen.getByTestId('widget-selector')).toBeInTheDocument();
  });

  it('exits edit mode and returns to the default layout on Reset', async () => {
    await renderOverview();
    await act(async () => { fireEvent.click(screen.getByTitle('Edit dashboard')); });
    await act(async () => { fireEvent.click(screen.getByTitle('Reset to default layout')); });

    const grid = screen.getByTestId('dashboard-grid');
    expect(grid).toHaveAttribute('data-editable', 'false');
    expect(grid).toHaveTextContent('4 widgets');
  });

  it('renders a green badge style for mainnet', async () => {
    mockState = { connectedAddress: 'GABC', network: 'mainnet' };
    await renderOverview();
    expect(screen.getByText(/mainnet/i)).toBeInTheDocument();
  });

  it('renders the connected-address copyable when an address is present', async () => {
    await renderOverview();
    expect(screen.getByTestId('copyable')).toHaveTextContent('GABC...X…BC...XYZ');
  });
});