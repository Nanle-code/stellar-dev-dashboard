import { test, expect } from '@playwright/test'
import { Keypair } from '@stellar/stellar-sdk'

const FRIEND_BOT_URL = 'https://friendbot.stellar.org'

let fundedPublicKey

async function connectTestnetAccount(page, publicKey) {
  await page.getByRole('button', { name: 'Test' }).click()
  await page.getByPlaceholder('G... public key').fill(publicKey)
  await page.getByRole('button', { name: /CONNECT/i }).click()
  await expect(page.getByText('Overview')).toBeVisible({ timeout: 20000 })
}

test.describe('Testnet faucet and contract interaction', () => {
  test.beforeAll(async ({ request }) => {
    const keypair = Keypair.random()
    fundedPublicKey = keypair.publicKey()

    const response = await request.get(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(fundedPublicKey)}`)
    expect(response.ok()).toBeTruthy()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('disables faucet navigation on mainnet', async ({ page }) => {
    await page.getByRole('button', { name: 'Main' }).click()
    const faucetButton = page.getByRole('button', { name: 'Faucet' })
    await expect(faucetButton).toBeDisabled()
  })

  test('funds a testnet account through the faucet', async ({ page }) => {
    await connectTestnetAccount(page, fundedPublicKey)

    await page.getByRole('button', { name: 'Faucet' }).click()
    await expect(page.getByText('Testnet Faucet')).toBeVisible()

    await page.getByPlaceholder('G... public key to fund').fill(fundedPublicKey)
    await page.getByRole('button', { name: /FUND ACCOUNT/i }).click()

    await expect(page.getByText('Account Funded!')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('✓ 10,000 XLM added to account on testnet')).toBeVisible()
  })

  test('shows contract interaction validation errors for invalid contract id', async ({ page }) => {
    await connectTestnetAccount(page, fundedPublicKey)

    await page.getByRole('button', { name: 'Contract Interaction' }).click()
    await expect(page.getByText('Contract Interaction')).toBeVisible()

    await page.getByPlaceholder('C... contract address').fill('invalid-contract')
    await page.getByRole('button', { name: /Simulate/i }).click()

    await expect(page.getByText('Invalid contract address')).toBeVisible({ timeout: 10000 })
  })
})
