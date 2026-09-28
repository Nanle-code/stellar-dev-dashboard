import { Server } from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

async function fetchAccount(publicKey) {
  const server = new Server(HORIZON_URL)
  const account = await server.accounts().accountId(publicKey).call()
  return account
}

async function main() {
  const publicKey = process.argv[2]
  if (!publicKey) {
    console.error('Usage: node docs/api/examples/js/stellar-horizon-account-example.js <PUBLIC_KEY>')
    process.exit(1)
  }

  try {
    const account = await fetchAccount(publicKey)
    console.log(JSON.stringify(account, null, 2))
  } catch (error) {
    console.error('Failed to fetch account:', error.message || error)
    process.exit(1)
  }
}

main()
