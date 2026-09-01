import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY

if (!PRIVATE_KEY) {
  throw new Error('SYNAPSE_PRIVATE_KEY environment variable is not set')
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

export function createPaymentsClient() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-backend',
  })

  return { synapse, client, account }
}

export async function getBalance(): Promise<bigint> {
  const { synapse } = createPaymentsClient()
  return await synapse.payments.walletBalance({
    token: TOKENS.USDFC,
  })
}

export async function getRunway(): Promise<bigint> {
  const { synapse } = createPaymentsClient()
  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })
  return summary.runwayInEpochs
}

export async function getAccountState(): Promise<{
  balance: bigint
  runway: bigint
  lockupRate: bigint
  currentEpoch: bigint
}> {
  const { synapse } = createPaymentsClient()
  const summary = await synapse.payments.accountSummary({
    token: TOKENS.USDFC,
  })

  return {
    balance: summary.availableFunds,
    runway: summary.runwayInEpochs,
    lockupRate: summary.lockupRatePerEpoch,
    currentEpoch: summary.epoch,
  }
}
