import { describe, it, expect } from 'vitest'
import { generateMarkdownFromPayload } from '../contractDocs.js'

describe('contractDocs generator', () => {
  it('generates markdown including function signature and params', () => {
    const payload = {
      contractId: 'GABC123TEST',
      network: 'testnet',
      functions: [
        {
          name: 'transfer',
          signature: 'transfer(to: Address, amount: U128) -> void',
          doc: 'Transfer tokens to an address.',
          summary: 'Transfer tokens',
          parameters: [
            { name: 'to', type: 'Address', description: 'Recipient address', required: true },
            { name: 'amount', type: 'U128', description: 'Amount to send', required: true },
          ],
          returnType: 'void',
        },
      ],
      customTypes: [],
    }

    const md = generateMarkdownFromPayload(payload)
    expect(md).toContain('# Contract Documentation: GABC123TEST')
    expect(md).toContain('### transfer')
    expect(md).toContain('transfer(to: Address, amount: U128)')
    expect(md).toContain('**Parameters**')
    expect(md).toContain('**Usage (JS)**')
  })
})
