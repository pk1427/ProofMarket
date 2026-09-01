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

// CONFIG: tune this amount during Day 7 calibration
const DEPOSIT_AMOUNT = BigInt(process.env.DEPOSIT_AMOUNT ?? '10000000000000000000')
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
    source: 'proofmarket-deposit',
  })

  console.log('=== ProofMarket: Deposit into Synapse Payments ===')
  console.log(`Wallet address: ${account.address}`)
  console.log(`Deposit amount: ${DEPOSIT_AMOUNT.toString()} wei (${Number(DEPOSIT_AMOUNT) / 1e18} USDFC)`)

  const beforeBalance = await synapse.payments.walletBalance({
    token: TOKENS.USDFC,
  })

  const beforeSummary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log('')
  console.log('BEFORE deposit:')
  console.log(`  Wallet USDFC:    ${beforeBalance.toString()} wei`)
  console.log(`  Payments balance: ${beforeSummary.availableFunds.toString()} wei`)
  console.log(`  Runway:           ${beforeSummary.runwayInEpochs.toString()} epochs`)
  console.log(`  Lockup rate:      ${beforeSummary.lockupRatePerEpoch.toString()}`)
  console.log('')

  if (beforeBalance < DEPOSIT_AMOUNT) {
    throw new Error(
      `Insufficient USDFC in wallet: have ${beforeBalance.toString()}, need ${DEPOSIT_AMOUNT.toString()}`
    )
  }

  // Approve Warm Storage service as operator (required for storage payment rails)
  console.log('Approving Warm Storage service as operator...')
  const warmStorageAddress = calibrationChain.contracts.fwss.address
  const approveTx = await synapse.payments.approveService({
    service: warmStorageAddress,
    rateAllowance: DEPOSIT_AMOUNT,
    lockupAllowance: DEPOSIT_AMOUNT,
    maxLockupPeriod: MAX_LOCKUP_PERIOD,
    token: TOKENS.USDFC,
  })
  console.log(`  Approval tx: ${approveTx}`)

  // Deposit into Payments contract
  console.log('Depositing USDFC into Payments contract...')
  const depositTx = await synapse.payments.deposit({
    amount: DEPOSIT_AMOUNT,
    token: TOKENS.USDFC,
  })
  console.log(`  Deposit tx: ${depositTx}`)

  const afterSummary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  console.log('')
  console.log('AFTER deposit:')
  console.log(`  Payments balance: ${afterSummary.availableFunds.toString()} wei`)
  console.log(`  Runway:           ${afterSummary.runwayInEpochs.toString()} epochs`)
  console.log(`  Lockup rate:      ${afterSummary.lockupRatePerEpoch.toString()}`)
  console.log(`  Current epoch:    ${afterSummary.epoch.toString()}`)
  console.log('')
  console.log('Deposit complete. Runway should now be a finite number.')
}

main().catch((err) => {
  console.error('Deposit failed:', err)
  process.exit(1)
})
