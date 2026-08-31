import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SlippageTradePanel } from '../SlippageTradePanel'
import type { OrderBookData, AmmPoolData } from '../../lib/slippageProtection'

describe('<SlippageTradePanel />', () => {
  const mockOrderbook: OrderBookData = {
    bids: [
      { price: '1.00', amount: '100' },
      { price: '0.95', amount: '200' },
      { price: '0.90', amount: '500' },
    ],
    asks: [
      { price: '1.05', amount: '100' },
      { price: '1.10', amount: '200' },
      { price: '1.15', amount: '500' },
    ],
  }

  const mockPool: AmmPoolData = {
    reserveA: 10000,
    reserveB: 10000,
    feePercent: 0.3,
  }

  it('Primary Flow: renders trade panel with spot price, price impact, and minimum received', () => {
    const onBuildTrade = vi.fn()
    render(
      <SlippageTradePanel
        sellingAsset="native"
        buyingAsset="USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        orderbook={mockOrderbook}
        onBuildTrade={onBuildTrade}
      />
    )

    expect(screen.getByText('Trade Execution & Slippage Protection')).toBeInTheDocument()
    expect(screen.getByText('Spot Price')).toBeInTheDocument()
    expect(screen.getByText('Price Impact')).toBeInTheDocument()

    // Click build protected trade
    const buildButton = screen.getByRole('button', { name: /Build Protected Trade/i })
    expect(buildButton).not.toBeDisabled()
    fireEvent.click(buildButton)

    expect(onBuildTrade).toHaveBeenCalledTimes(1)
    expect(onBuildTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        isValid: true,
        slippageTolerancePercent: 0.5,
      })
    )
  })

  it('Boundary Case: handles custom slippage setting and sell/buy tab switching', () => {
    render(
      <SlippageTradePanel
        sellingAsset="native"
        buyingAsset="USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        orderbook={mockOrderbook}
      />
    )

    // Select 1.0% preset button
    const presetButton = screen.getByRole('button', { name: '1%' })
    fireEvent.click(presetButton)

    // Switch to Buy tab
    const buyTabButton = screen.getByRole('button', { name: /Buy USDC/i })
    fireEvent.click(buyTabButton)

    expect(screen.getByText(/Buy Amount \(USDC\)/i)).toBeInTheDocument()
  })

  it('Failure Case & Resilience: disables build button and displays alert when price impact exceeds slippage tolerance', () => {
    render(
      <SlippageTradePanel
        sellingAsset="native"
        buyingAsset="USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        orderbook={mockOrderbook}
      />
    )

    // Enter large amount that pushes price impact high
    const amountInput = screen.getByLabelText(/Trade amount/i)
    fireEvent.change(amountInput, { target: { value: '700' } })

    // Set tight custom slippage tolerance (0.1%)
    const customSlippageInput = screen.getByLabelText(/Custom slippage percentage/i)
    fireEvent.change(customSlippageInput, { target: { value: '0.1' } })

    // Alert should appear explaining block
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/Trade Protected: Trade blocked by slippage protection/)

    // Button should be disabled
    const blockedButton = screen.getByRole('button', { name: /Trade Blocked by Slippage Protection/i })
    expect(blockedButton).toBeDisabled()
  })

  it('Failure Case: handles liquidity shortage gracefully', () => {
    render(
      <SlippageTradePanel
        sellingAsset="native"
        buyingAsset="USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        orderbook={mockOrderbook}
      />
    )

    const amountInput = screen.getByLabelText(/Trade amount/i)
    fireEvent.change(amountInput, { target: { value: '99999' } })

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/Insufficient orderbook liquidity/)
  })
})
