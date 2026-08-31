import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import * as StellarSdk from '@stellar/stellar-sdk'
import ContractEventDisplay, {
  decodeScValOrXdr,
  isBase64Xdr,
  truncate,
} from '../ContractEventDisplay'

describe('ContractEventDisplay utilities', () => {
  it('correctly identifies valid base64 XDR strings', () => {
    const symbolXdr = StellarSdk.nativeToScVal('transfer', { type: 'symbol' }).toXDR('base64')
    expect(isBase64Xdr(symbolXdr)).toBe(true)
    expect(isBase64Xdr('not a valid base64!')).toBe(false)
    expect(isBase64Xdr(12345)).toBe(false)
    expect(isBase64Xdr(null)).toBe(false)
  })

  it('decodes ScVal base64 XDR into typed native values', () => {
    const symbolXdr = StellarSdk.nativeToScVal('transfer', { type: 'symbol' }).toXDR('base64')
    const decoded = decodeScValOrXdr(symbolXdr)

    expect(decoded.nativeValue).toBe('transfer')
    expect(decoded.typeLabel).toBe('symbol')
    expect(decoded.isXdrFallback).toBe(false)
    expect(decoded.rawXdr).toBe(symbolXdr)
  })

  it('handles native primitives, BigInts, and Stellar addresses directly', () => {
    expect(decodeScValOrXdr(true)).toEqual({
      nativeValue: true,
      displayString: 'true',
      typeLabel: 'bool',
      isXdrFallback: false,
    })

    expect(decodeScValOrXdr(1000n)).toEqual({
      nativeValue: 1000n,
      displayString: '1000',
      typeLabel: 'i128',
      isXdrFallback: false,
    })

    const addr = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1'
    expect(decodeScValOrXdr(addr)).toEqual({
      nativeValue: addr,
      displayString: addr,
      typeLabel: 'address',
      isXdrFallback: false,
    })
  })

  it('safely falls back to raw XDR when XDR decoding fails or input is malformed', () => {
    // Valid base64 but invalid ScVal XDR payload
    const invalidScValXdr = 'AAAABBBBCCCCDDDD'
    const decoded = decodeScValOrXdr(invalidScValXdr)

    expect(decoded.isXdrFallback).toBe(true)
    expect(decoded.typeLabel).toBe('xdr')
    expect(decoded.displayString).toBe(invalidScValXdr)
  })

  it('truncates strings correctly', () => {
    expect(truncate('short')).toBe('short')
    expect(truncate('GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1', 20)).toContain('…')
    expect(truncate(null as any)).toBe('')
  })
})

describe('<ContractEventDisplay /> Component', () => {
  afterEach(() => {
    cleanup()
  })

  it('Primary Flow: renders typed contract events with decoded topics and value', () => {
    const symbolXdr = StellarSdk.nativeToScVal('transfer', { type: 'symbol' }).toXDR('base64')
    const sampleEvents = [
      {
        type: 'contract',
        contractId: 'CCONTRACT1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
        topics: [symbolXdr, 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1'],
        value: 5000n,
        inSuccessfulContractCall: true,
      },
    ]

    render(<ContractEventDisplay events={sampleEvents} label="Test Contract Events" />)

    expect(screen.getByText('Test Contract Events')).toBeInTheDocument()
    expect(screen.getByText(/1 event/)).toBeInTheDocument()
    expect(screen.getAllByText('contract').length).toBeGreaterThan(0)
    expect(screen.getByText('symbol')).toBeInTheDocument()
    expect(screen.getByText('transfer')).toBeInTheDocument()
    expect(screen.getByText(/5000/)).toBeInTheDocument()
  })

  it('Filtering & Searching: filters events by topic, type, or search query', () => {
    const symbolXdr = StellarSdk.nativeToScVal('mint', { type: 'symbol' }).toXDR('base64')
    const sampleEvents = [
      {
        type: 'contract',
        contractId: 'CCONTRACT111',
        topics: [symbolXdr],
        value: '100',
      },
      {
        type: 'system',
        contractId: 'CCONTRACT222',
        topics: ['system_topic'],
        value: '200',
      },
    ]

    render(<ContractEventDisplay events={sampleEvents} />)

    const searchInput = screen.getByPlaceholderText('Search topics, values, types...')
    fireEvent.change(searchInput, { target: { value: 'mint' } })

    expect(screen.getByText(/1 matching/)).toBeInTheDocument()
    expect(screen.getAllByText(/CCONTRACT111/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/CCONTRACT222/)).not.toBeInTheDocument()

    // Filter by type pill
    fireEvent.change(searchInput, { target: { value: '' } })
    const systemFilterButton = screen.getByRole('button', { name: 'system' })
    fireEvent.click(systemFilterButton)

    expect(screen.getByText(/1 matching/)).toBeInTheDocument()
    expect(screen.getAllByText(/CCONTRACT222/).length).toBeGreaterThan(0)
  })

  it('Boundary Case: handles empty arrays, missing fields, and raw XDR fallback mode', () => {
    // 1. Empty events
    const { rerender } = render(<ContractEventDisplay events={[]} />)
    expect(screen.getByText('No contract events emitted')).toBeInTheDocument()

    // 2. Non-array / null / undefined input
    rerender(<ContractEventDisplay events={null} />)
    expect(screen.getByText('No contract events emitted')).toBeInTheDocument()

    rerender(<ContractEventDisplay events={'invalid_primitive_input'} />)
    expect(screen.getByText('No contract events emitted')).toBeInTheDocument()

    // 3. Raw XDR fallback event
    const rawXdrEvent = [
      {
        type: 'contract',
        contractId: 'CCONTRACT333',
        topics: ['AAAABBBBCCCCDDDD'], // Unparseable XDR blob
        value: 'EEEEFFFFGGGGHHHH',
      },
    ]

    rerender(<ContractEventDisplay events={rawXdrEvent} />)
    expect(screen.getAllByText(/xdr \(fallback\)/i).length).toBeGreaterThan(0)
  })

  it('Failure Path & Resilience: gracefully handles corrupted event objects and missing clipboard API', () => {
    const corruptedEvents = [
      null as any,
      undefined as any,
      {
        type: 'diagnostic',
        contractId: null,
        topics: null as any,
        value: undefined,
        inSuccessfulContractCall: false,
      },
    ]

    render(<ContractEventDisplay events={corruptedEvents} />)

    expect(screen.getByText(/Malformed event item at index #1/i)).toBeInTheDocument()
    expect(screen.getByText(/Malformed event item at index #2/i)).toBeInTheDocument()
    expect(screen.getAllByText('diagnostic').length).toBeGreaterThan(0)
    expect(screen.getByText('diagnostic only')).toBeInTheDocument()
  })
})
