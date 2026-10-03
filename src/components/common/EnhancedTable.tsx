import React, { useState, useCallback } from 'react';
import { Settings, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';

export type TableDensity = 'compact' | 'comfortable' | 'spacious';

export interface ColumnPreset {
  id: string;
  name: string;
  columns: string[];
  density: TableDensity;
}

interface EnhancedTableProps {
  columns: { id: string; label: string; width?: string }[];
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  presets: ColumnPreset[];
  onPresetSave: (preset: ColumnPreset) => void;
  onPresetDelete: (id: string) => void;
  onPresetApply: (preset: ColumnPreset) => void;
  children: React.ReactNode;
  stickyHeader?: boolean;
  maxHeight?: string;
}

const DENSITY_STYLES: Record<TableDensity, { padding: string; fontSize: string; rowHeight: string }> = {
  compact: { padding: '8px 12px', fontSize: '11px', rowHeight: '40px' },
  comfortable: { padding: '12px 18px', fontSize: '12px', rowHeight: '60px' },
  spacious: { padding: '16px 24px', fontSize: '13px', rowHeight: '80px' },
};

export default function EnhancedTable({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  density,
  onDensityChange,
  presets,
  onPresetSave,
  onPresetDelete,
  onPresetApply,
  children,
  stickyHeader = true,
  maxHeight = '600px',
}: EnhancedTableProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const toggleColumn = useCallback((columnId: string) => {
    if (visibleColumns.includes(columnId)) {
      if (visibleColumns.length > 1) {
        onVisibleColumnsChange(visibleColumns.filter((id) => id !== columnId));
      }
    } else {
      onVisibleColumnsChange([...visibleColumns, columnId]);
    }
  }, [visibleColumns, onVisibleColumnsChange]);

  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    onPresetSave({
      id: `preset-${Date.now()}`,
      name: newPresetName,
      columns: visibleColumns,
      density,
    });
    setNewPresetName('');
    setShowPresetsMenu(false);
  }, [newPresetName, visibleColumns, density, onPresetSave]);

  const currentStyle = DENSITY_STYLES[density];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Density Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDensityMenu(!showDensityMenu)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)',
            }}
          >
            <Settings size={14} />
            <span>{density}</span>
            {showDensityMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDensityMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 100,
                minWidth: '120px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {(Object.keys(DENSITY_STYLES) as TableDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    onDensityChange(d);
                    setShowDensityMenu(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    background: density === d ? 'var(--cyan-glow-sm)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: density === d ? 'var(--cyan)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    textTransform: 'capitalize',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Column Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)',
            }}
          >
            <span>Columns</span>
            {showColumnMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showColumnMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 100,
                minWidth: '150px',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {columns.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    disabled={visibleColumns.length === 1 && visibleColumns.includes(col.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Presets */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)',
            }}
          >
            <Save size={14} />
            <span>Presets</span>
            {showPresetsMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPresetsMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 100,
                minWidth: '200px',
                maxHeight: '400px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {presets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      <button
                        onClick={() => {
                          onPresetApply(preset);
                          setShowPresetsMenu(false);
                        }}
                        style={{
                          flex: 1,
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: '4px',
                        }}
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => onPresetDelete(preset.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--red)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <input
                  type="text"
                  placeholder="New preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    marginBottom: '6px',
                  }}
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--cyan)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: 'white',
                    fontSize: '12px',
                    cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                    opacity: newPresetName.trim() ? 1 : 0.5,
                  }}
                >
                  Save Current View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxHeight,
        }}
      >
        {/* Sticky Header */}
        {stickyHeader && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              padding: currentStyle.padding,
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-card)',
              zIndex: 10,
              display: 'grid',
              gridTemplateColumns: visibleColumns.map((id) => {
                const col = columns.find((c) => c.id === id);
                return col?.width || '1fr';
              }).join(' '),
              gap: '12px',
              fontSize: currentStyle.fontSize,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600,
            }}
          >
            {visibleColumns.map((colId) => {
              const col = columns.find((c) => c.id === colId);
              return <span key={colId}>{col?.label || colId}</span>;
            })}
          </div>
        )}

        {/* Table Body */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: stickyHeader ? `calc(${maxHeight} - ${currentStyle.rowHeight})` : maxHeight,
          }}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                density,
                visibleColumns,
                columns,
                currentStyle,
              });
            }
            return child;
          })}
        </div>
      </div>
    </div>
  );
}