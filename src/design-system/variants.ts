export type VariantStatus = 'ready' | 'planned' | 'guidance'

export interface VariantDefinition {
  key: string
  label: string
  description: string
  composition: string[]
  status: VariantStatus
}

export interface VariantGroup {
  key: string
  label: string
  purpose: string
  variants: VariantDefinition[]
}

export const variantSystem: VariantGroup[] = [
  {
    key: 'buttons',
    label: 'Buttons',
    purpose: 'Primary and secondary actions should be composed from the same token set.',
    variants: [
      {
        key: 'primary',
        label: 'Primary',
        description: 'High-emphasis actions for the main flow.',
        composition: ['brand.primary', 'text.inverse', 'radii.pill', 'spacing.sm'],
        status: 'ready',
      },
      {
        key: 'secondary',
        label: 'Secondary',
        description: 'Supports lower-emphasis actions without introducing a new style family.',
        composition: ['surface.card', 'border.default', 'text.primary', 'spacing.sm'],
        status: 'guidance',
      },
      {
        key: 'danger',
        label: 'Danger',
        description: 'Reserved for destructive actions and irreversible flows.',
        composition: ['semantic.danger', 'text.inverse', 'border.strong'],
        status: 'planned',
      },
    ],
  },
  {
    key: 'badges',
    label: 'Badges',
    purpose: 'Badges should communicate state, not introduce unrelated styling.',
    variants: [
      {
        key: 'neutral',
        label: 'Neutral',
        description: 'Metadata, counts, and labels.',
        composition: ['surface.elevated', 'text.secondary', 'border.subtle'],
        status: 'ready',
      },
      {
        key: 'success',
        label: 'Success',
        description: 'Positive outcomes and completed workflows.',
        composition: ['semantic.success', 'text.inverse'],
        status: 'guidance',
      },
      {
        key: 'warning',
        label: 'Warning',
        description: 'Potentially risky states that require attention.',
        composition: ['semantic.warning', 'text.inverse'],
        status: 'guidance',
      },
    ],
  },
  {
    key: 'cards',
    label: 'Cards',
    purpose: 'Cards should share spacing, elevation, and radius rules across the app.',
    variants: [
      {
        key: 'default',
        label: 'Default',
        description: 'Standard content containers.',
        composition: ['surface.card', 'border.default', 'spacing.card', 'radii.lg'],
        status: 'ready',
      },
      {
        key: 'elevated',
        label: 'Elevated',
        description: 'Highlighted summaries or higher-priority panels.',
        composition: ['surface.elevated', 'border.strong', 'spacing.card', 'radii.lg'],
        status: 'guidance',
      },
    ],
  },
]
