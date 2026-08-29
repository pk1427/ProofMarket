import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('ERROR: SYNAPSE_PRIVATE_KEY environment variable is not set.')
  console.error('Set it with: export SYNAPSE_PRIVATE_KEY=0x...')
  process.exit(1)
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

const USDFC_FAUCET_URL = 'https://faucet.reiers.io/'
const CHAINSAFE_USDFC_FAUCET_URL = 'https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc'

async function main() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-fund',
  })

  console.log('=== ProofMarket: Wallet Funding Check ===')
  console.log(`Wallet address: ${account.address}`)
  console.log('')

  const usdfcBalance = await synapse.payments.walletBalance({
    token: TOKENS.USDFC,
  })

  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log(`USDFC Wallet Balance: ${usdfcBalance.toString()} wei`)
  console.log(`Payments Balance:     ${summary.availableFunds.toString()} wei`)
  console.log(`Runway (epochs):      ${summary.runwayInEpochs.toString()}`)
  console.log(`Lockup rate:          ${summary.lockupRatePerEpoch.toString()}`)
  console.log('')

  if (usdfcBalance === 0n) {
    console.log('Wallet has 0 USDFC. Claim from a faucet first:')
    console.log(`  1. ${USDFC_FAUCET_URL}`)
    console.log(`  2. ${CHAINSAFE_USDFC_FAUCET_URL}`)
    console.log(`  3. Paste address: ${account.address}`)
    console.log('')
    console.log('After claiming, re-run: npx tsx verify-testnet.ts')
    process.exit(1)
  }

  console.log('Wallet is funded. Ready for deposit into Synapse Payments contract.')
}

main().catch((err) => {
  console.error('Funding check failed:', err)
  process.exit(1)
})
