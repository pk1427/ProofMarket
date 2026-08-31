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

// CONFIG: tuned for 2-3 minute demo window
const TRIAGE_THRESHOLD_EPOCHS = 10000
const TARGET_REMAINING_EPOCHS = 10005
const MAX_LOCKUP_PERIOD = 100000n

async function main() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-refund',
  })

  console.log('=== ProofMarket: Re-fund Wallet for Demo ===')
  console.log(`Wallet address: ${account.address}`)

  const walletBalance = await synapse.payments.walletBalance({
    token: TOKENS.USDFC,
  })

  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log(`Wallet USDFC:     ${Number(walletBalance) / 1e18} USDFC`)
  console.log(`Payments balance: ${Number(summary.availableFunds) / 1e18} USDFC`)
  console.log(`Runway:           ${summary.runwayInEpochs.toString()} epochs`)
  console.log(`Lockup rate:      ${Number(summary.lockupRatePerEpoch) / 1e18} USDFC/epoch`)
  console.log('')

  const targetBalance = summary.lockupRatePerEpoch * BigInt(TARGET_REMAINING_EPOCHS)
  const depositAmount = targetBalance > summary.availableFunds ? targetBalance - summary.availableFunds : 0n

  console.log(`Target balance for ${TARGET_REMAINING_EPOCHS} epochs: ${Number(targetBalance) / 1e18} USDFC`)
  console.log(`Deposit amount needed: ${Number(depositAmount) / 1e18} USDFC`)
  console.log('')

  if (depositAmount === 0n) {
    console.log('Balance is already at or above target.')
    const epochsToThreshold = Number(summary.runwayInEpochs - BigInt(TRIAGE_THRESHOLD_EPOCHS))
    const minutesToThreshold = epochsToThreshold / 2
    console.log(`Estimated time to triage threshold: ~${minutesToThreshold.toFixed(1)} minutes`)
    return
  }

  if (walletBalance < depositAmount) {
    console.error(`Insufficient USDFC in wallet: have ${Number(walletBalance) / 1e18}, need ${Number(depositAmount) / 1e18}`)
    console.log('Claim from faucet first:')
    console.log('  https://faucet.reiers.io/')
    console.log(`  Address: ${account.address}`)
    process.exit(1)
  }

  console.log('Approving Warm Storage service as operator...')
  const warmStorageAddress = calibrationChain.contracts.fwss.address
  const approveTx = await synapse.payments.approveService({
    service: warmStorageAddress,
    rateAllowance: depositAmount,
    lockupAllowance: depositAmount,
    maxLockupPeriod: MAX_LOCKUP_PERIOD,
    token: TOKENS.USDFC,
  })
  console.log(`  Approval tx: ${approveTx}`)

  console.log('Depositing USDFC into Payments contract...')
  const depositTx = await synapse.payments.deposit({
    amount: depositAmount,
    token: TOKENS.USDFC,
  })
  console.log(`  Deposit tx: ${depositTx}`)

  const afterSummary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log('')
  console.log('AFTER deposit:')
  console.log(`  Payments balance: ${Number(afterSummary.availableFunds) / 1e18} USDFC`)
  console.log(`  Runway:           ${afterSummary.runwayInEpochs.toString()} epochs`)
  console.log(`  Lockup rate:      ${Number(afterSummary.lockupRatePerEpoch) / 1e18} USDFC/epoch`)
  console.log('')

  const epochsToThreshold = Number(afterSummary.runwayInEpochs - BigInt(TRIAGE_THRESHOLD_EPOCHS))
  const minutesToThreshold = epochsToThreshold / 2
  console.log(`Estimated time to triage threshold: ~${minutesToThreshold.toFixed(1)} minutes`)
  console.log('')
  console.log('Re-fund complete. Ready for demo.')
}

main().catch((err) => {
  console.error('Re-fund failed:', err)
  process.exit(1)
})
