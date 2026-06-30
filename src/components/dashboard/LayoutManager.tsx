import React, { useState, useEffect, useCallback } from 'react';
import { 
  loadAllLayouts, 
  saveLayout, 
  deleteLayout, 
  getActiveLayoutId, 
  setActiveLayout, 
  getActiveLayout,
  duplicateLayout,
  exportLayout,
  importLayout,
  PRESET_LAYOUTS,
  generateLayoutId,
  createEmptyLayout,
  type DashboardLayout 
} from '../../lib/dashboardLayouts';
import { useResponsive } from '../../hooks/useResponsive';
import { addBreadcrumb } from '../../lib/errorReporting';
import { 
  Plus, 
  Copy, 
  Trash2, 
  Download, 
  Upload, 
  X, 
  Check, 
  LayoutTemplate,
  Share2,
  Settings
} from 'lucide-react';

interface LayoutManagerProps {
  isOpen: boolean;
  currentWidgets: any[];
  onLayoutChange: (widgets: any[]) => void;
  onLayoutsChange?: () => Promise<void>;
  onClose: () => void;
}

export default function LayoutManager({ isOpen, currentWidgets, onLayoutChange, onLayoutsChange, onClose }: LayoutManagerProps) {
  const { isMobile } = useResponsive() as { isMobile: boolean };
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [importData, setImportData] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLayouts();
    }
  }, [isOpen]);

  const loadLayouts = async () => {
    const allLayouts = await loadAllLayouts();
    const activeId = await getActiveLayoutId();
    setLayouts(allLayouts);
    setActiveLayoutId(activeId);
  };

  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) return;

    const newLayout = createEmptyLayout(newLayoutName);
    newLayout.widgets = currentWidgets.map(w => ({
      id: w.id,
      type: w.type,
      height: w.height,
      span: w.span,
    }));

    await saveLayout(newLayout);
    await setActiveLayout(newLayout.id);
    await loadLayouts();
    setShowCreateModal(false);
    setNewLayoutName('');
    addBreadcrumb('Layout created', 'user_action', { layoutId: newLayout.id, name: newLayout.name });
  };

  const handleSwitchLayout = async (layout: DashboardLayout) => {
    await setActiveLayout(layout.id);
    setActiveLayoutId(layout.id);
    onLayoutChange(layout.widgets);
    addBreadcrumb('Layout switched', 'user_action', { layoutId: layout.id, name: layout.name });
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (!confirm('Are you sure you want to delete this layout?')) return;
    await deleteLayout(layoutId);
    await loadLayouts();
    addBreadcrumb('Layout deleted', 'user_action', { layoutId });
  };

  const handleDuplicateLayout = async (layoutId: string) => {
    const duplicated = await duplicateLayout(layoutId);
    await loadLayouts();
    addBreadcrumb('Layout duplicated', 'user_action', { 
      originalId: layoutId, 
      newId: duplicated.id 
    });
  };

  const handleExportLayout = (layout: DashboardLayout) => {
    const exported = exportLayout(layout);
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.name.replace(/\s+/g, '-').toLowerCase()}-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
    addBreadcrumb('Layout exported', 'user_action', { layoutId: layout.id });
  };

  const handleImportLayout = async () => {
    if (!importData.trim()) return;

    try {
      const imported = importLayout(importData);
      await saveLayout(imported);
      await loadLayouts();
      setShowImportModal(false);
      setImportData('');
      addBreadcrumb('Layout imported', 'user_action', { layoutId: imported.id });
    } catch (error) {
      alert(`Failed to import layout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleApplyPreset = async (presetId: string) => {
    const preset = PRESET_LAYOUTS.find(p => p.id === presetId);
    if (!preset) return;

    const newLayout: DashboardLayout = {
      id: generateLayoutId(),
      name: preset.name,
      description: preset.description,
      widgets: preset.widgets,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPreset: true,
    };

    await saveLayout(newLayout);
    await setActiveLayout(newLayout.id);
    onLayoutChange(preset.widgets);
    await loadLayouts();
    addBreadcrumb('Preset layout applied', 'user_action', { presetId: preset.id });
  };

  const handleShareLayout = (layout: DashboardLayout) => {
    const exported = exportLayout(layout);
    const shareToken = btoa(exported);
    navigator.clipboard.writeText(shareToken);
    alert('Layout share code copied to clipboard!');
    addBreadcrumb('Layout shared', 'user_action', { layoutId: layout.id });
  };

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '16px' : '32px',
  };

  const modalStyles: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: isMobile ? '100%' : '900px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '16px 20px' : '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LayoutTemplate size={20} style={{ color: 'var(--cyan)' }} />
            <div>
              <h2 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                fontFamily: 'var(--font-display)',
              }}>
                Dashboard Layouts
              </h2>
              <p style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                margin: '4px 0 0 0',
              }}>
                Manage and switch between custom layouts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: isMobile ? '16px' : '24px',
        }}>
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'var(--cyan)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {!isMobile && 'Save Current Layout'}
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Upload size={14} />
              {!isMobile && 'Import'}
            </button>
          </div>

          {/* Preset Layouts */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <LayoutTemplate size={16} style={{ color: 'var(--cyan)' }} />
              Preset Layouts
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}>
              {PRESET_LAYOUTS.map(preset => (
                <div
                  key={preset.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                  onClick={() => handleApplyPreset(preset.id)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--cyan)';
                    e.currentTarget.style.boxShadow = '0 4px 12px var(--cyan-glow-sm)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{preset.icon}</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                  }}>
                    {preset.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}>
                    {preset.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Layouts */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Settings size={16} style={{ color: 'var(--cyan)' }} />
              Your Layouts ({layouts.length})
            </h3>
            
            {layouts.length === 0 ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  No saved layouts
                </div>
                <div style={{ fontSize: '12px' }}>
                  Save your current dashboard or apply a preset to get started
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
              }}>
                {layouts.map(layout => (
                  <div
                    key={layout.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: activeLayoutId === layout.id 
                        ? '2px solid var(--cyan)' 
                        : '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '16px',
                      transition: 'var(--transition)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          {layout.name}
                          {activeLayoutId === layout.id && (
                            <Check size={14} style={{ color: 'var(--green)' }} />
                          )}
                        </div>
                        {layout.description && (
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            marginBottom: '4px',
                          }}>
                            {layout.description}
                          </div>
                        )}
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}>
                          {layout.widgets.length} widgets
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '12px',
                    }}>
                      <button
                        onClick={() => handleSwitchLayout(layout)}
                        style={{
                          flex: 1,
                          minWidth: '60px',
                          padding: '6px 10px',
                          background: activeLayoutId === layout.id ? 'var(--green)' : 'var(--cyan)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {activeLayoutId === layout.id ? 'Active' : 'Switch'}
                      </button>

                      <button
                        onClick={() => handleDuplicateLayout(layout.id)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Duplicate"
                      >
                        <Copy size={12} />
                      </button>

                      <button
                        onClick={() => handleExportLayout(layout)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Export"
                      >
                        <Download size={12} />
                      </button>

                      <button
                        onClick={() => handleShareLayout(layout)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Share"
                      >
                        <Share2 size={12} />
                      </button>

                      <button
                        onClick={() => handleDeleteLayout(layout.id)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--red-glow)',
                          color: 'var(--red)',
                          border: '1px solid var(--red)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Layout Modal */}
        {showCreateModal && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }} onClick={() => setShowCreateModal(false)}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}>
                Save Current Layout
              </h3>
              <input
                type="text"
                placeholder="Layout name"
                value={newLayoutName}
                onChange={e => setNewLayoutName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreateLayout()}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLayout}
                  disabled={!newLayoutName.trim()}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--cyan)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: newLayoutName.trim() ? 'pointer' : 'not-allowed',
                    opacity: newLayoutName.trim() ? 1 : 0.5,
                  }}
                >
                  Save Layout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }} onClick={() => setShowImportModal(false)}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}>
                Import Layout
              </h3>
              <textarea
                placeholder="Paste layout JSON or share code here..."
                value={importData}
                onChange={e => setImportData(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  minHeight: '120px',
                  marginBottom: '16px',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowImportModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportLayout}
                  disabled={!importData.trim()}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--cyan)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: importData.trim() ? 'pointer' : 'not-allowed',
                    opacity: importData.trim() ? 1 : 0.5,
                  }}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}