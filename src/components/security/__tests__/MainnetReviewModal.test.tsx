import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainnetReviewModal from '../MainnetReviewModal'
import type { MainnetReviewItem } from '../MainnetReviewModal'

const baseItems: MainnetReviewItem[] = [
  { label: 'Network', value: 'Mainnet (Public)', highlight: true },
  { label: 'Source', value: 'GABCD123…XYZ98765', mono: true },
  { label: 'Fee', value: '100 stroops', mono: true },
]

function setup(overrides: Partial<React.ComponentProps<typeof MainnetReviewModal>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <MainnetReviewModal
      actionTitle="Sign Transaction"
      irreversible
      items={baseItems}
      warnings={['Real funds will be transferred.']}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  )
  return { onConfirm, onCancel }
}

describe('MainnetReviewModal', () => {
  // ── Primary flow ────────────────────────────────────────────────────────────

  it('renders the action title', () => {
    setup()
    expect(screen.getByText('Sign Transaction')).toBeDefined()
  })

  it('displays all review items', () => {
    setup()
    expect(screen.getByText('Network')).toBeDefined()
    expect(screen.getByText('Mainnet (Public)')).toBeDefined()
    expect(screen.getByText('Source')).toBeDefined()
    expect(screen.getByText('GABCD123…XYZ98765')).toBeDefined()
  })

  it('shows the Mainnet network badge', () => {
    setup()
    // Badge text "Stellar Mainnet (Public Network)" and acknowledgement both contain the phrase
    const matches = screen.getAllByText(/Stellar Mainnet/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    // Ensure the badge is present specifically
    expect(screen.getByText('Stellar Mainnet (Public Network)')).toBeDefined()
  })

  it('displays custom warnings', () => {
    setup()
    expect(screen.getByText('Real funds will be transferred.')).toBeDefined()
  })

  it('confirm button is disabled until checkbox is checked', () => {
    setup()
    const confirmBtn = screen.getByRole('button', { name: /Confirm.*Proceed/i })
    expect(confirmBtn).toHaveProperty('disabled', true)
  })

  it('enables confirm button after checking the acknowledgement', () => {
    setup()
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    const confirmBtn = screen.getByRole('button', { name: /Confirm.*Proceed/i })
    expect(confirmBtn).toHaveProperty('disabled', false)
  })

  it('calls onConfirm when confirmed after acknowledgement', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Confirm.*Proceed/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onConfirm when confirm button is clicked without acknowledgement', () => {
    const { onConfirm } = setup()
    // Button is disabled — clicking a disabled button should not fire
    const confirmBtn = screen.getByRole('button', { name: /Confirm.*Proceed/i })
    fireEvent.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // ── Boundary cases ──────────────────────────────────────────────────────────

  it('shows irreversibility warning when irreversible=true', () => {
    setup({ irreversible: true })
    expect(screen.getByText(/irreversible/i)).toBeDefined()
  })

  it('does NOT show irreversibility warning when irreversible=false', () => {
    setup({ irreversible: false })
    const msgs = screen.queryAllByText(/irreversible/i)
    expect(msgs.length).toBe(0)
  })

  it('renders multiple review items correctly', () => {
    const items: MainnetReviewItem[] = [
      { label: 'Op 1', value: 'payment', highlight: false },
      { label: 'Amount 1', value: '50 XLM', highlight: true },
      { label: 'Destination 1', value: 'GXYZ…ABCD', mono: true },
    ]
    setup({ items })
    expect(screen.getByText('Op 1')).toBeDefined()
    expect(screen.getByText('payment')).toBeDefined()
    expect(screen.getByText('Amount 1')).toBeDefined()
    expect(screen.getByText('50 XLM')).toBeDefined()
  })

  it('renders with no warnings when warnings array is empty', () => {
    // Should not throw and should still render the modal
    setup({ warnings: [] })
    expect(screen.getByText('Sign Transaction')).toBeDefined()
  })

  // ── Failure / cancel paths ──────────────────────────────────────────────────

  it('calls onCancel when Cancel button is clicked', () => {
    const { onCancel } = setup()
    const cancelBtn = screen.getAllByRole('button', { name: /Cancel/i })[0]
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the close (X) button is clicked', () => {
    const { onCancel } = setup()
    const closeBtn = screen.getByRole('button', { name: /Cancel and close/i })
    fireEvent.click(closeBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('checkbox toggles acknowledgement state correctly', () => {
    setup()
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('has the correct aria attributes for accessibility', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('mainnet-review-title')
  })
})
