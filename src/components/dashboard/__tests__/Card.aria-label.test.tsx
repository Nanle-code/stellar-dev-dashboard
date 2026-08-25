import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import Card from '../Card'

describe('<Card /> aria-label', () => {
  it('accepts and applies an aria-label to the container (primary flow)', () => {
    const { container } = render(
      <Card aria-label="Budget overview" title="Overview">
        <div>content</div>
      </Card>,
    )
    expect(container.firstElementChild).toHaveAttribute('aria-label', 'Budget overview')
  })

  it('does not render an aria-label attribute when none is provided', () => {
    const { container } = render(
      <Card>
        <div>content</div>
      </Card>,
    )
    expect(container.firstElementChild).not.toHaveAttribute('aria-label')
  })
})
