import React, { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { DEFAULT_THEME_DEFINITION, PRESET_THEMES, generateThemeId } from '../../styles/themeTypes'
import ColorPicker from './ColorPicker'
import FontSelector from './FontSelector'
import SpacingSlider from './SpacingSlider'
import LivePreview from './LivePreview'
import ThemePresets from './ThemePresets'
import ThemeImportExport from './ThemeImportExport'
import MarketplacePanel from './MarketplacePanel'
import ShareButton from './ShareButton'

export default function ThemeBuilder() {
  const draft = useStore((s) => s.themeBuilderDraft)
  const customTheme = useStore((s) => s.customTheme)
  const setDraft = useStore((s) => s.setThemeBuilderDraft)

  useEffect(() => {
    if (!draft) {
      setDraft(customTheme || DEFAULT_THEME_DEFINITION)
    }
  }, [])

  const safe = draft || customTheme || DEFAULT_THEME_DEFINITION
  const colors = safe.colors
  const typography = safe.typography
  const spacing = safe.spacing

  const handleChange = (section, value) => {
    const updated = { ...safe }
    if (section === 'colors') updated.colors = value
    else if (section === 'typography') updated.typography = value
    else if (section === 'spacing') updated.spacing = value
    setDraft(updated)
  }

  const handlePresetSelect = (presetId) => {
    if (presetId === 'custom') {
      const source = customTheme || DEFAULT_THEME_DEFINITION
      setDraft({ ...source, id: source.id, name: source.name })
      return
    }
    const preset = PRESET_THEMES.find((p) => p.id === presetId)
    if (preset) setDraft({ ...preset })
  }

  const handleImport = (theme) => {
    setDraft({ ...theme, id: theme.id || generateThemeId() })
  }

  const handleMarketplaceInstall = (theme) => {
    setDraft({
      ...theme,
      id: generateThemeId(),
      name: theme.name,
    })
  }

  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      flexWrap: 'wrap',
    }}>
      <div style={{
        flex: '1 1 280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        minWidth: '200px',
      }}>
        <ThemePresets draft={safe} onSelect={handlePresetSelect} />
        <ColorPicker colors={colors} onChange={handleChange} />
        <FontSelector
          fontFamily={typography.fontFamily}
          fontScale={typography.fontScale}
          onChange={handleChange}
        />
        <SpacingSlider baseUnit={spacing.baseUnit} onChange={handleChange} />
        <ThemeImportExport draft={safe} onImport={handleImport} />
        <ShareButton />
        <MarketplacePanel onInstall={handleMarketplaceInstall} />
      </div>

      <div style={{
        flex: '1 1 280px',
        minWidth: '200px',
        alignSelf: 'flex-start',
      }}>
        <LivePreview colors={colors} typography={typography} spacing={spacing} />
      </div>
    </div>
  )
}
