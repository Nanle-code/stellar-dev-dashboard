import { useState, useCallback, useEffect } from 'react';
import type { ColumnPreset, TableDensity } from '../components/common/EnhancedTable';

const STORAGE_KEY = 'table-presets';
const STATE_STORAGE_KEY = 'table-state';

export function useTablePresets(tableId: string, initialColumns: string[] = [], initialDensity: TableDensity = 'comfortable') {
  const [presets, setPresets] = useState<ColumnPreset[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(initialColumns);
  const [density, setDensity] = useState<TableDensity>(initialDensity);

  // Load presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allPresets = JSON.parse(stored);
        const tablePresets = allPresets[tableId] || [];
        setPresets(tablePresets);
      }
    } catch (error) {
      console.error('Failed to load table presets:', error);
    }
  }, [tableId]);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STATE_STORAGE_KEY);
      if (stored) {
        const allStates = JSON.parse(stored);
        const tableState = allStates[tableId];
        if (tableState) {
          if (tableState.visibleColumns && tableState.visibleColumns.length > 0) {
            setVisibleColumns(tableState.visibleColumns);
          }
          if (tableState.density) {
            setDensity(tableState.density);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load table state:', error);
    }
  }, [tableId]);

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STATE_STORAGE_KEY);
      const allStates = stored ? JSON.parse(stored) : {};
      allStates[tableId] = { visibleColumns, density };
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(allStates));
    } catch (error) {
      console.error('Failed to save table state:', error);
    }
  }, [tableId, visibleColumns, density]);

  // Save presets to localStorage
  const savePresets = useCallback((newPresets: ColumnPreset[]) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allPresets = stored ? JSON.parse(stored) : {};
      allPresets[tableId] = newPresets;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPresets));
      setPresets(newPresets);
    } catch (error) {
      console.error('Failed to save table presets:', error);
    }
  }, [tableId]);

  const handlePresetSave = useCallback((preset: ColumnPreset) => {
    const newPresets = [...presets, preset];
    savePresets(newPresets);
  }, [presets, savePresets]);

  const handlePresetDelete = useCallback((id: string) => {
    const newPresets = presets.filter((p) => p.id !== id);
    savePresets(newPresets);
  }, [presets, savePresets]);

  const handlePresetApply = useCallback((preset: ColumnPreset) => {
    setVisibleColumns(preset.columns);
    setDensity(preset.density);
  }, []);

  return {
    presets,
    visibleColumns,
    setVisibleColumns,
    density,
    setDensity,
    onPresetSave: handlePresetSave,
    onPresetDelete: handlePresetDelete,
    onPresetApply: handlePresetApply,
  };
}