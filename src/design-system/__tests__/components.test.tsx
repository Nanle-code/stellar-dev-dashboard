import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Badge,
  Card,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components'

describe('design-system primitives', () => {
  it('renders card, stack, badge, skeleton, and semantic table primitives', () => {
    render(
      <Card title="Wallet activity">
        <Stack direction="row" gap="sm">
          <Badge tone="success">Connected</Badge>
          <Skeleton shape="text" />
        </Stack>
        <Table caption="Recent transactions">
          <TableHead><TableRow><TableHeader>Type</TableHeader></TableRow></TableHead>
          <TableBody><TableRow><TableCell>Payment</TableCell></TableRow></TableBody>
        </Table>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'Wallet activity' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Recent transactions' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeTruthy()
    expect(screen.getByText('Connected').className).toContain('ds-badge--success')
  })

  it('keeps layout children when stack uses the smallest spacing boundary', () => {
    render(<Stack gap="none"><span>First</span><span>Second</span></Stack>)
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByText('Second')).toBeTruthy()
    expect(screen.getByText('First').parentElement?.className).toContain('ds-stack--gap-none')
  })

  it('marks loading skeletons decorative for assistive technology', () => {
    render(<Skeleton shape="panel" />)
    expect(document.querySelector('.ds-skeleton')?.getAttribute('aria-hidden')).toBe('true')
  })
})