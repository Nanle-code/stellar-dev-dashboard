import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DocsCacheManager from '../DocsCacheManager';
import { useDocsCache } from '../../hooks/useDocsCache';

// Mock the useDocsCache hook
vi.mock('../../hooks/useDocsCache');

describe('DocsCacheManager Component', () => {
  const mockDocsCache = {
    isCached: false,
    isUpdating: false,
    lastUpdated: null,
    error: null,
    updateAvailable: false,
    cacheSize: 0,
    cacheSizeLimit: 50 * 1024 * 1024,
    cachedDocs: [],
    cacheDocs: vi.fn(),
    clearDocsCache: vi.fn(),
    updateDocsCache: vi.fn(),
    checkCacheStatus: vi.fn(),
    getCachedDoc: vi.fn(),
    isDocCached: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocsCache as any).mockReturnValue(mockDocsCache);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render cache manager with not cached status', () => {
    render(<DocsCacheManager />);

    expect(screen.getByText('Documentation Not Cached')).toBeInTheDocument();
    expect(screen.getByText('Cache documentation to access it offline')).toBeInTheDocument();
  });

  it('should render cache manager with cached status', () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
      lastUpdated: new Date('2024-01-01'),
      cachedDocs: [
        { url: '/docs/getting-started', timestamp: Date.now(), size: 1024 },
        { url: '/docs/api-reference', timestamp: Date.now(), size: 2048 },
      ],
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    expect(screen.getByText('Documentation Cached for Offline Use')).toBeInTheDocument();
    expect(screen.getByText('Last updated:')).toBeInTheDocument();
  });

  it('should call updateDocsCache when Update Cache button is clicked', async () => {
    render(<DocsCacheManager />);

    const updateButton = screen.getByText('Update Cache');
    fireEvent.click(updateButton);

    expect(mockDocsCache.updateDocsCache).toHaveBeenCalled();
  });

  it('should show updating state when cache is being updated', () => {
    const updatingState = {
      ...mockDocsCache,
      isUpdating: true,
    };

    (useDocsCache as any).mockReturnValue(updatingState);

    render(<DocsCacheManager />);

    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('should call clearDocsCache when Clear Cache button is clicked', async () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    const clearButton = screen.getByText('Clear Cache');
    fireEvent.click(clearButton);

    // Since it uses window.confirm, we need to mock it
    window.confirm = vi.fn(() => true);
    fireEvent.click(clearButton);

    expect(mockDocsCache.clearDocsCache).toHaveBeenCalled();
  });

  it('should show cache details when Show Details button is clicked', () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
      cachedDocs: [
        { url: '/docs/getting-started', timestamp: Date.now(), size: 1024 },
        { url: '/docs/api-reference', timestamp: Date.now(), size: 2048 },
      ],
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    const showDetailsButton = screen.getByText('Show Details');
    fireEvent.click(showDetailsButton);

    expect(screen.getByText('Total Documents')).toBeInTheDocument();
    expect(screen.getByText('Cache Size')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
    expect(screen.getByText('Cached Documents')).toBeInTheDocument();
  });

  it('should display error message when cache error occurs', () => {
    const errorState = {
      ...mockDocsCache,
      error: 'Cache API not available',
    };

    (useDocsCache as any).mockReturnValue(errorState);

    render(<DocsCacheManager />);

    expect(screen.getByText('Cache API not available')).toBeInTheDocument();
  });

  it('should calculate cache size correctly', () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
      cachedDocs: [
        { url: '/docs/getting-started', timestamp: Date.now(), size: 1024 },
        { url: '/docs/api-reference', timestamp: Date.now(), size: 2048 },
      ],
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    const showDetailsButton = screen.getByText('Show Details');
    fireEvent.click(showDetailsButton);

    expect(screen.getByText('3.0 KB')).toBeInTheDocument(); // (1024 + 2048) / 1024
  });

  it('should call checkCacheStatus when Refresh button is clicked', () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockDocsCache.checkCacheStatus).toHaveBeenCalled();
  });

  it('should hide details when Hide Details button is clicked', () => {
    const cachedState = {
      ...mockDocsCache,
      isCached: true,
      cachedDocs: [
        { url: '/docs/getting-started', timestamp: Date.now(), size: 1024 },
      ],
    };

    (useDocsCache as any).mockReturnValue(cachedState);

    render(<DocsCacheManager />);

    const showDetailsButton = screen.getByText('Show Details');
    fireEvent.click(showDetailsButton);

    expect(screen.getByText('Cached Documents')).toBeInTheDocument();

    const hideDetailsButton = screen.getByText('Hide Details');
    fireEvent.click(hideDetailsButton);

    expect(screen.queryByText('Cached Documents')).not.toBeInTheDocument();
  });
});