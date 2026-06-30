import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { addBreadcrumb } from '../../lib/errorReporting';

export interface Widget {
  id: string;
  type?: string;
  component: React.ReactNode;
  width?: number;
  height?: number;
  span?: number;
}

export interface GridColumns {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface DashboardGridProps {
  widgets?: Widget[];
  onLayoutChange?: (layout: Widget[]) => void;
  onWidgetResize?: (widget: Widget, size: { height: number; span: number }) => void;
  onWidgetRemove?: (widget: Widget) => void;
  editable?: boolean;
  columns?: GridColumns;
  gap?: number;
  minWidgetHeight?: number;
  rowHeight?: number;
}

/**
 * Customizable responsive dashboard grid with drag-and-drop and resizable widgets.
 * Width resizing persists as a grid column span so layouts stay fluid at every breakpoint.
 */
export default function DashboardGrid({
  widgets = [],
  onLayoutChange,
  onWidgetResize,
  onWidgetRemove,
  editable = false,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 16,
  minWidgetHeight = 200,
  rowHeight = 80,
}: DashboardGridProps) {
  const [layout, setLayout] = useState<Widget[]>(widgets);
  const [draggedWidget, setDraggedWidget] = useState<{ widget: Widget; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [resizingWidget, setResizingWidget] = useState<{ widget: Widget; index: number, initialSpan: number } | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });

  const gridRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet } = useResponsive() as { isMobile: boolean; isTablet: boolean };
  const { handleError } = useErrorHandler('DashboardGrid');

  // Get responsive column count
  const getColumnCount = (): number => {
    if (isMobile) return columns.mobile;
    if (isTablet) return columns.tablet;
    return columns.desktop;
  };

  useEffect(() => {
    setLayout(widgets);
  }, [widgets]);

  const columnCount = isMobile ? columns.mobile : isTablet ? columns.tablet : columns.desktop;

  const clampSpan = useCallback((span) => {
    if (isMobile) return 1;
    const parsed = Number(span) || 1;
    return Math.min(Math.max(parsed, 1), columnCount);
  }, [columnCount, isMobile]);

  const getGridColumnWidth = useCallback(() => {
    const gridWidth = gridRef.current?.getBoundingClientRect().width || 0;
    if (!gridWidth || columnCount <= 0) return 0;
    return (gridWidth - gap * (columnCount - 1)) / columnCount;
  }, [columnCount, gap]);

  // Handle layout changes
  const updateLayout = useCallback((newLayout: Widget[]) => {
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
    addBreadcrumb('Dashboard layout updated', 'user_action', {
      widgetCount: newLayout.length,
      editable,
    });
  }, [onLayoutChange, editable]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, widget: Widget, index: number) => {
    if (!editable) return;

    setDraggedWidget({ widget, index });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', (event.target as HTMLElement).outerHTML);
    (event.currentTarget as HTMLElement).style.opacity = '0.5';

    addBreadcrumb('Widget drag started', 'user_action', {
      widgetId: widget.id,
      widgetType: widget.type,
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    (event.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedWidget(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!editable || !draggedWidget) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    if (!editable || !draggedWidget) return;

    event.preventDefault();

    const { index: dragIndex } = draggedWidget;
    if (dragIndex === dropIndex) return;

    const newLayout = [...layout];
    const [draggedItem] = newLayout.splice(dragIndex, 1);
    newLayout.splice(dropIndex, 0, draggedItem);

    updateLayout(newLayout);
    setDragOverIndex(null);

    addBreadcrumb('Widget dropped', 'user_action', {
      from: dragIndex,
      to: dropIndex,
      widgetId: draggedItem.id,
    });
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLButtonElement>, widget: Widget, index: number) => {
    if (!editable) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = ((event.currentTarget as HTMLElement).closest('.widget-container') as HTMLElement).getBoundingClientRect();
    setResizingWidget({
      widget,
      index,
      initialSpan: clampSpan(widget.span || 1),
    });
    setResizeStartPos({ x: event.clientX, y: event.clientY });
    setResizeStartSize({ width: rect.width, height: rect.height });

    addBreadcrumb('Widget resize started', 'user_action', {
      widgetId: widget.id,
    });
  };

  const handleResizeMove = useCallback((event: MouseEvent) => {
    if (!resizingWidget) return;

    const deltaX = event.clientX - resizeStartPos.x;
    const deltaY = event.clientY - resizeStartPos.y;
    const columnWidth = getGridColumnWidth();
    const resizedWidth = Math.max(columnWidth || 1, resizeStartSize.width + deltaX);
    const spanFromWidth = columnWidth
      ? Math.round((resizedWidth + gap) / (columnWidth + gap))
      : resizingWidget.initialSpan;
    const nextSpan = clampSpan(spanFromWidth);
    const nextHeight = Math.max(minWidgetHeight, Math.round(resizeStartSize.height + deltaY));

    const widgetElement = document.querySelector(`[data-widget-id="${resizingWidget.widget.id}"]`) as HTMLElement;
    if (widgetElement) {
      widgetElement.style.gridColumn = `span ${nextSpan}`;
      widgetElement.style.height = `${nextHeight}px`;
      widgetElement.style.gridRow = `span ${Math.max(1, Math.ceil((nextHeight + gap) / (rowHeight + gap)))}`;
    }
  }, [
    resizingWidget,
    resizeStartPos,
    resizeStartSize,
    getGridColumnWidth,
    gap,
    rowHeight,
    clampSpan,
    minWidgetHeight,
  ]);

  const handleResizeEnd = useCallback(() => {
    if (!resizingWidget) return;

    try {
      const widgetElement = document.querySelector(`[data-widget-id="${resizingWidget.widget.id}"]`) as HTMLElement;
      if (!widgetElement) return;

      const rect = widgetElement.getBoundingClientRect();
      const columnWidth = getGridColumnWidth();
      const nextSpan = columnWidth
        ? clampSpan(Math.round((rect.width + gap) / (columnWidth + gap)))
        : resizingWidget.initialSpan;
      const nextHeight = Math.max(minWidgetHeight, Math.round(rect.height));
      const updatedWidget: Widget = {
        ...resizingWidget.widget,
        span: nextSpan,
        height: nextHeight,
      };

      const newLayout = [...layout];
      newLayout[resizingWidget.index] = updatedWidget;
      updateLayout(newLayout);
      onWidgetResize?.(updatedWidget, { span: nextSpan, height: nextHeight });

      addBreadcrumb('Widget resized', 'user_action', {
        widgetId: updatedWidget.id,
        newSize: { span: nextSpan, height: nextHeight },
      });
    } catch (error) {
      handleError(error);
    } finally {
      setResizingWidget(null);
    }
  }, [
    resizingWidget,
    layout,
    updateLayout,
    onWidgetResize,
    getGridColumnWidth,
    gap,
    clampSpan,
    minWidgetHeight,
    handleError,
  ]);

  useEffect(() => {
    if (!resizingWidget) return undefined;

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.userSelect = '';
    };
  }, [resizingWidget, handleResizeMove, handleResizeEnd]);

  // Remove widget
  const handleRemoveWidget = (widget: Widget, index: number) => {
    if (!editable) return;

    const newLayout = layout.filter((_, i) => i !== index);
    updateLayout(newLayout);
    onWidgetRemove?.(widget);

    addBreadcrumb('Widget removed', 'user_action', {
      widgetId: widget.id,
      widgetType: widget.type
    });
  };

  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gridAutoRows: `${rowHeight}px`,
    gridAutoFlow: 'row',
    gap: `${gap}px`,
    width: '100%',
    minHeight: '200px',
    position: 'relative',
    alignItems: 'stretch',
    transition: 'grid-template-columns 180ms ease, gap 180ms ease',
  };

  const getWidgetStyles = (widget: Widget, index: number): React.CSSProperties => {
    const height = Math.max(Number(widget.height) || minWidgetHeight, minWidgetHeight);
    const rowSpan = Math.max(1, Math.ceil((height + gap) / (rowHeight + gap)));
    const isResizing = resizingWidget?.index === index;
    const baseStyles: React.CSSProperties = {
      position: 'relative',
      minHeight: `${minWidgetHeight}px`,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: isResizing
        ? 'border-color 120ms ease, box-shadow 120ms ease'
        : 'grid-column 180ms ease, grid-row 180ms ease, height 180ms ease, border-color 120ms ease, box-shadow 120ms ease',
      cursor: editable ? 'move' : 'default',
      width: '100%',
      minWidth: 0,
      height: `${height}px`,
      gridColumn: `span ${clampSpan(widget.span)}`,
      gridRow: `span ${rowSpan}`,
    };

    if (dragOverIndex === index && draggedWidget?.index !== index) {
      baseStyles.borderColor = 'var(--cyan)';
      baseStyles.boxShadow = '0 0 0 2px var(--cyan-glow)';
    }

    if (isResizing) {
      baseStyles.borderColor = 'var(--amber)';
      baseStyles.boxShadow = '0 0 0 2px var(--amber-glow)';
    }

    return baseStyles;
  };

  return (
    <div
      ref={gridRef}
      style={gridStyles}
      className="dashboard-grid"
      data-columns={columnCount}
    >
      {layout.map((widget, index) => (
        <div
          key={widget.id}
          data-widget-id={widget.id}
          className="widget-container"
          style={getWidgetStyles(widget, index)}
          draggable={editable && !resizingWidget}
          onDragStart={(event) => handleDragStart(event, widget, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => handleDragOver(event, index)}
          onDrop={(event) => handleDrop(event, index)}
          onMouseEnter={(event) => {
            if (editable) {
              event.currentTarget.style.borderColor = 'var(--cyan)';
            }
          }}
          onMouseLeave={(event) => {
            if (editable && dragOverIndex !== index && resizingWidget?.index !== index) {
              event.currentTarget.style.borderColor = 'var(--border)';
            }
          }}
        >
          {editable && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                display: 'flex',
                gap: '4px',
                zIndex: 10,
                opacity: 0,
                transition: 'opacity var(--transition)'
              }}
              className="widget-controls"
            >
              <button
                onMouseDown={(event) => handleResizeStart(event, widget, index)}
                style={{
                  width: '24px',
                  height: '24px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'nwse-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
                title="Resize widget"
              >
                <Maximize2 size={12} />
              </button>

              <button
                onClick={() => handleRemoveWidget(widget, index)}
                style={{
                  width: '24px',
                  height: '24px',
                  background: 'var(--red-glow)',
                  border: '1px solid var(--red)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--red)',
                }}
                title="Remove widget"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{
            width: '100%',
            height: '100%',
            pointerEvents: editable ? 'none' : 'auto',
          }}>
            {widget.component}
          </div>

        </div>
      ))}

      {layout.length === 0 && (
        <div style={{
          gridColumn: `span ${columnCount}`,
          gridRow: 'span 4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          background: 'var(--bg-card)',
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '40px 20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>+</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            No Widgets Added
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.5, maxWidth: '300px' }}>
            {editable
              ? 'Add widgets to customize your dashboard layout.'
              : 'Enable edit mode to add and arrange widgets.'
            }
          </div>
        </div>
      )}
    </div>
  );
}
