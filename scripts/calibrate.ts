import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY!
if (!PRIVATE_KEY) {
  console.error('SYNAPSE_PRIVATE_KEY required')
  process.exit(1)
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`
const TRIAGE_THRESHOLD_EPOCHS = Number(process.env.TRIAGE_THRESHOLD_EPOCHS ?? 100_000_000)
const RESUME_MARGIN_EPOCHS = Number(process.env.RESUME_MARGIN_EPOCHS ?? 10_000_000)
const MARGIN_PERCENT = Number(process.env.CALIBRATE_MARGIN ?? 0.05) // 5% above critical line

async function main() {
  const account = privateKeyToAccount(normalizedKey)
  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })
  const synapse = new Synapse({ client, source: 'proofmarket-calibrate' })

  console.log('=== ProofMarket: Demo Calibration ===')
  console.log(`Wallet address: ${account.address}`)
  console.log('')

  const walletBalance = await synapse.payments.walletBalance({ token: TOKENS.USDFC })
  const summary = await synapse.payments.accountSummary({ token: TOKENS.USDFC })

  console.log('Current state:')
  console.log(`  Wallet USDFC:     ${Number(walletBalance) / 1e18} USDFC`)
  console.log(`  Payments balance: ${Number(summary.availableFunds) / 1e18} USDFC`)
  console.log(`  Runway:           ${summary.runwayInEpochs.toString()} epochs`)
  console.log(`  Lockup rate:      ${Number(summary.lockupRatePerEpoch) / 1e18} USDFC/epoch`)
  console.log('')

  const criticalBalance = BigInt(TRIAGE_THRESHOLD_EPOCHS) * summary.lockupRatePerEpoch
  const targetBalance = criticalBalance + BigInt(Math.floor(Number(criticalBalance) * MARGIN_PERCENT))
  const withdrawalAmount = summary.availableFunds > targetBalance ? summary.availableFunds - targetBalance : 0n

  console.log('Calibration targets:')
  console.log(`  Threshold:           ${TRIAGE_THRESHOLD_EPOCHS.toLocaleString()} epochs`)
  console.log(`  Resume margin:       ${RESUME_MARGIN_EPOCHS.toLocaleString()} epochs`)
  console.log(`  Critical balance:    ${Number(criticalBalance) / 1e18} USDFC`)
  console.log(`  Target balance:      ${Number(targetBalance) / 1e18} USDFC (critical + ${MARGIN_PERCENT * 100}% margin)`)
  console.log(`  Withdrawal amount:   ${Number(withdrawalAmount) / 1e18} USDFC`)
  console.log('')

  if (withdrawalAmount === 0n) {
    console.log('Balance is already at or below target. No withdrawal needed.')
    const epochsToThreshold = Number(summary.runwayInEpochs - BigInt(TRIAGE_THRESHOLD_EPOCHS))
    const minutesToThreshold = epochsToThreshold / 2
    console.log(`Current runway: ${summary.runwayInEpochs.toString()} epochs`)
    console.log(`Epochs above threshold: ${epochsToThreshold.toLocaleString()}`)
    console.log(`At current drain rate, natural crossing would take ~${(epochsToThreshold / 2 / (60*60*24)).toFixed(1)} days`)
    return
  }

  if (walletBalance < withdrawalAmount) {
    console.error(`Insufficient USDFC in wallet: have ${Number(walletBalance) / 1e18}, need ${Number(withdrawalAmount) / 1e18}`)
    process.exit(1)
  }

  const shouldExecute = process.env.EXECUTE === '1'

  if (shouldExecute) {
    console.log('Executing withdrawal...')
    const tx = await synapse.payments.withdraw({
      amount: withdrawalAmount,
      token: TOKENS.USDFC,
    })
    console.log(`  Withdrawal tx: ${tx}`)
    console.log('')

    const afterSummary = await synapse.payments.accountSummary({ token: TOKENS.USDFC })
    console.log('After withdrawal:')
    console.log(`  Payments balance: ${Number(afterSummary.availableFunds) / 1e18} USDFC`)
    console.log(`  Runway:           ${afterSummary.runwayInEpochs.toString()} epochs`)
    console.log(`  Outcome:          ${afterSummary.runwayInEpochs >= BigInt(TRIAGE_THRESHOLD_EPOCHS) ? 'HEALTHY' : 'CRITICAL'}`)
  } else {
    console.log('Ready to execute withdrawal.')
    console.log(`  Withdraw ${Number(withdrawalAmount) / 1e18} USDFC to reach ${Number(targetBalance) / 1e18} USDFC`)
    console.log(`  This will leave ~${Number(targetBalance) / 1e18} USDFC in Payments contract`)
    console.log(`  Projected runway after withdrawal: ${(targetBalance / summary.lockupRatePerEpoch).toString()} epochs`)
    console.log('')
    console.log('To execute, run with EXECUTE=1:')
    console.log(`  EXECUTE=1 npx tsx calibrate.ts`)
  }

  console.log('')
  console.log('Demo mechanic recommendation:')
  console.log('  - Start at this target balance (just above critical line)')
  console.log('  - Show HEALTHY state for 30-60 seconds')
  console.log('  - Execute a second small withdrawal live to cross into CRITICAL')
  console.log('  - This is honest, real onchain, and staged timing — normal for demos')
}

main().catch((err) => {
  console.error('Calibration failed:', err)
  process.exit(1)
})
