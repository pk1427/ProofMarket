import { createClient, http } from 'viem'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getPdpDataSet,
  terminateServiceSync,
  extractPDPPaymentTerminatedEvent,
} from '@filoz/synapse-core/warm-storage'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('SYNAPSE_PRIVATE_KEY not set')
const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

const account = privateKeyToAccount(normalizedKey as `0x${string}`)
const client = createClient({ chain: calibrationChain, transport: http('https://api.calibration.node.glif.io/rpc/v1'), account })

export type InterventionResult = {
  timestamp: string
  action: 'pause'
  datasetName: string
  datasetId: string
  txHash?: string
  endEpoch?: string
  status: 'pending' | 'completed' | 'failed'
  error?: string
}

const HISTORY_FILE = join(__dirname, '..', 'data', 'interventions.json')

function appendIntervention(result: InterventionResult) {
  const existing = existsSync(HISTORY_FILE) ? JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')) : []
  existing.push(result)
  writeFileSync(HISTORY_FILE, JSON.stringify(existing, null, 2))
}

export async function pauseDataset(datasetId: string, datasetName: string): Promise<InterventionResult> {
  const result: InterventionResult = {
    timestamp: new Date().toISOString(),
    action: 'pause',
    datasetName,
    datasetId,
    status: 'pending',
  }

  try {
    const dataset = await getPdpDataSet(client, { dataSetId: BigInt(datasetId) })
    if (!dataset) {
      throw new Error(`Dataset #${datasetId} not found`)
    }

    const { receipt } = await terminateServiceSync(client, {
      dataSetId: BigInt(datasetId),
    })

    const terminatedEvent = extractPDPPaymentTerminatedEvent(receipt.logs)
    result.txHash = receipt.transactionHash
    result.endEpoch = terminatedEvent.args.endEpoch.toString()
    result.status = 'completed'
  } catch (err) {
    result.status = 'failed'
    result.error = err instanceof Error ? err.message : String(err)
  }

  appendIntervention(result)
  return result
}
