import { createRoot } from 'react-dom/client'
import { Badge, Card, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../src/design-system/components'

function DesignSystemShowcase() {
  return (
    <main className="design-system-visual" data-testid="design-system-visual">
      <Stack gap="lg">
        <header className="design-system-visual__heading">
          <p className="design-system-visual__eyebrow">Stellar Dev Dashboard</p>
          <h1>Design system</h1>
          <p className="design-system-visual__copy">Theme-aware shared primitives</p>
        </header>
        <Card title="Wallet status" subtitle="Account connection" action={<Badge tone="success">Connected</Badge>}>
          <div className="design-system-visual__content">
            <Stack direction="row" gap="sm" wrap>
              <Badge tone="info">Testnet</Badge>
              <Badge tone="warning">Review needed</Badge>
              <Badge tone="danger">Unavailable</Badge>
              <Badge>Read only</Badge>
            </Stack>
          </div>
        </Card>
        <Card title="Loading state">
          <div className="design-system-visual__content">
            <Stack gap="sm">
              <Skeleton shape="heading" />
              <Skeleton shape="text" />
              <Skeleton shape="panel" />
            </Stack>
          </div>
        </Card>
        <Card title="Recent activity">
          <Table caption="Latest account operations">
            <TableHead>
              <TableRow><TableHeader>Operation</TableHeader><TableHeader>Amount</TableHeader><TableHeader>Status</TableHeader></TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell>Payment</TableCell><TableCell>12.5 XLM</TableCell><TableCell><Badge tone="success">Confirmed</Badge></TableCell></TableRow>
              <TableRow><TableCell>Trustline</TableCell><TableCell>USD</TableCell><TableCell><Badge tone="info">Applied</Badge></TableCell></TableRow>
            </TableBody>
          </Table>
        </Card>
      </Stack>
    </main>
  )
}

createRoot(document.getElementById('design-system-visual-root')!).render(<DesignSystemShowcase />)