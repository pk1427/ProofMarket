import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('ERROR: SYNAPSE_PRIVATE_KEY environment variable is not set.')
  console.error('Set it with: export SYNAPSE_PRIVATE_KEY=0x...')
  process.exit(1)
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

async function main() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibration,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-verify',
  })

  console.log('=== ProofMarket Hard Gate: Calibration Testnet Verification ===')
  console.log(`Wallet address: ${account.address}`)
  console.log('')

  const usdfcBalance = await synapse.payments.walletBalance({
    token: TOKENS.USDFC,
  })

  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log(`USDFC Balance:    ${usdfcBalance.toString()} (raw wei units)`)
  console.log(`Runway (epochs):  ${summary.runwayInEpochs.toString()}`)
  console.log(`Available funds:  ${summary.availableFunds.toString()}`)
  console.log(`Lockup rate:      ${summary.lockupRatePerEpoch.toString()}`)
  console.log(`Current epoch:    ${summary.epoch.toString()}`)
  console.log('')
  console.log('Hard gate check: PASSED — real onchain values returned.')
}

main().catch((err) => {
  console.error('Hard gate check: FAILED')
  console.error(err)
  process.exit(1)
})
