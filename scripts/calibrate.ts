import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY
if (!PRIVATE_KEY) {
  console.error('ERROR: SYNAPSE_PRIVATE_KEY environment variable is not set.')
  process.exit(1)
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

const TRIAGE_THRESHOLD_EPOCHS = 10000
const TARGET_REMAINING_EPOCHS = 10005
const EPOCHS_PER_MINUTE = 2

async function main() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-calibrate',
  })

  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  const currentBalance = summary.availableFunds
  const lockupRate = summary.lockupRatePerEpoch

  const targetBalance = lockupRate * BigInt(TARGET_REMAINING_EPOCHS)
  const withdrawAmount = currentBalance > targetBalance ? currentBalance - targetBalance : 0n

  console.log('Current Payments balance:', Number(currentBalance) / 1e18, 'USDFC')
  console.log('Target balance for', TARGET_REMAINING_EPOCHS, 'epochs:', Number(targetBalance) / 1e18, 'USDFC')
  console.log('Withdraw amount:', Number(withdrawAmount) / 1e18, 'USDFC')

  if (withdrawAmount === 0n) {
    console.log('Already at or below target.')
    return
  }

  console.log('Withdrawing...')
  const tx = await synapse.payments.withdraw({
    amount: withdrawAmount,
    token: TOKENS.USDFC,
  })
  console.log('Withdraw tx:', tx)

  const after = await synapse.payments.accountSummary({ token: TOKENS.USDFC })
  console.log('New balance:', Number(after.availableFunds) / 1e18, 'USDFC')
  console.log('New runway:', after.runwayInEpochs.toString(), 'epochs')

  const epochsToThreshold = Number(after.runwayInEpochs - BigInt(TRIAGE_THRESHOLD_EPOCHS))
  const minutesToThreshold = epochsToThreshold / EPOCHS_PER_MINUTE
  console.log('Minutes to threshold:', minutesToThreshold.toFixed(1))
}

main().catch((err) => {
  console.error('Calibration failed:', err)
  process.exit(1)
})
