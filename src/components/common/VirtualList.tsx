import React, { useState, useEffect, useRef, useMemo, useCallback, ReactNode, UIEvent } from 'react';

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number | ((index: number, item: T) => number);
  overscan?: number;
  children: (item: T, index: number) => ReactNode;
  onLoadMore?: () => void;
  loading?: boolean;
  className?: string;
  containerStyle?: React.CSSProperties;
}

const VirtualList = <T,>({
  items,
  rowHeight,
  overscan = 5,
  children,
  onLoadMore,
  loading = false,
  className = '',
  containerStyle = {},
}: VirtualListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const inFlightRef = useRef(false);
  const loadingRef = useRef(loading);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading) {
      inFlightRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Cache for dynamic heights and positions
  const metadata = useMemo(() => {
    const positions: number[] = [0];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const height = typeof rowHeight === 'function' ? rowHeight(i, items[i]) : rowHeight;
      totalHeight += height;
      positions.push(totalHeight);
    }

    return { positions, totalHeight };
  }, [items, rowHeight]);

  // Binary search to find the start index for a given scroll position
  const findStartIndex = (scrollPos: number) => {
    let low = 0;
    let high = metadata.positions.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (metadata.positions[mid] <= scrollPos) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return Math.max(0, low - 1);
  };

  const handleScroll = useCallback((_e: UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const currentScrollTop = containerRef.current.scrollTop;
      setScrollTop(currentScrollTop);

      // Check if we need to load more
      if (onLoadMoreRef.current && !loadingRef.current && !inFlightRef.current) {
        const { scrollHeight, clientHeight } = containerRef.current;
        if (currentScrollTop + clientHeight >= scrollHeight - 200) {
          inFlightRef.current = true;
          onLoadMoreRef.current();
        }
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Reset scroll to top when items change (e.g. new search results)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  const { start, end, translateY } = useMemo(() => {
    const startIndex = findStartIndex(scrollTop);
    const endIndex = findStartIndex(scrollTop + containerHeight);

    const actualStart = Math.max(0, startIndex - overscan);
    const actualEnd = Math.min(items.length, endIndex + overscan);

    return {
      start: actualStart,
      end: actualEnd,
      translateY: metadata.positions[actualStart],
    };
  }, [scrollTop, containerHeight, overscan, items.length, metadata]);

  const visibleItems = items.slice(start, end).map((item, index) => {
    const actualIndex = start + index;
    return (
      <div key={actualIndex} style={{ height: typeof rowHeight === 'function' ? rowHeight(actualIndex, item) : rowHeight }}>
        {children(item, actualIndex)}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{
        overflowY: 'auto',
        position: 'relative',
        willChange: 'transform',
        ...containerStyle,
      }}
    >
      {/* Spacer to force scrollbar */}
      <div style={{ height: metadata.totalHeight, position: 'relative' }}>
        {/* Virtualized content window */}
        <div
          style={{
            transform: `translateY(${translateY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            willChange: 'transform',
          }}
        >
          {visibleItems}
          
          {loading && (
             <div style={{ padding: '20px', textAlign: 'center' }}>
               <div className="spinner" />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;
