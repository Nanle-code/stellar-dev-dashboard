import type { Meta, StoryObj } from '@storybook/react'
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
} from '../src/design-system/components'

const meta: Meta = {
  title: 'Design System/Primitives',
  parameters: {
    docs: {
      description: {
        component: 'Reusable surfaces and layout primitives styled with runtime theme tokens.',
      },
    },
  },
}

export default meta

export const CardAndStack: StoryObj = {
  render: () => (
    <Card title="Account overview" subtitle="Theme-aware surface" action={<Badge tone="success">Connected</Badge>}>
      <div className="design-system-story-content">
        <Stack direction="row" gap="md" wrap>
          <span>Available balance</span>
          <strong>1,248.50 XLM</strong>
        </Stack>
      </div>
    </Card>
  ),
}

export const BadgeTones: StoryObj = {
  render: () => (
    <Stack direction="row" gap="sm" wrap>
      <Badge>Neutral</Badge>
      <Badge tone="info">Information</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="danger">Failure</Badge>
    </Stack>
  ),
}

export const LoadingSkeletons: StoryObj = {
  render: () => (
    <Card title="Loading state">
      <div className="design-system-story-content">
        <Stack gap="md">
          <Skeleton shape="heading" />
          <Skeleton shape="text" />
          <Skeleton shape="panel" />
        </Stack>
      </div>
    </Card>
  ),
}

export const DataTable: StoryObj = {
  render: () => (
    <Table caption="Recent account activity">
      <TableHead>
        <TableRow>
          <TableHeader>Type</TableHeader>
          <TableHeader>Amount</TableHeader>
          <TableHeader>Status</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>Payment</TableCell>
          <TableCell>12.5 XLM</TableCell>
          <TableCell><Badge tone="success">Confirmed</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Trustline</TableCell>
          <TableCell>—</TableCell>
          <TableCell><Badge tone="info">Applied</Badge></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}