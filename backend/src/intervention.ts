import { createClient, http } from 'viem'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getPdpDataSet,
  terminateServiceSync,
  extractPDPPaymentTerminatedEvent,
} from '@filoz/synapse-core/warm-storage'
import * as Piece from '@filoz/synapse-core/piece'
import * as SP from '@filoz/synapse-core/sp'
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
  action: 'pause' | 'resume'
  datasetName: string
  datasetId: string
  newDatasetId?: string
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

function loadDatasets() {
  const path = join(__dirname, '..', 'data', 'datasets.json')
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function saveDatasets(datasets: any[]) {
  const path = join(__dirname, '..', 'data', 'datasets.json')
  writeFileSync(path, JSON.stringify(datasets, null, 2))
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

export async function resumeDataset(datasetId: string, datasetName: string): Promise<InterventionResult> {
  const result: InterventionResult = {
    timestamp: new Date().toISOString(),
    action: 'resume',
    datasetName,
    datasetId,
    status: 'pending',
  }

  try {
    const datasets = loadDatasets()
    const dataset = datasets.find((d: any) => d.datasetId === datasetId)
    if (!dataset) {
      throw new Error(`Dataset #${datasetId} not found in local metadata`)
    }

    const providers = await getApprovedPDPProviders()
    if (providers.length === 0) {
      throw new Error('No approved PDP providers found')
    }
    const provider = providers[0]

    const fileData = new TextEncoder().encode(
      `ProofMarket resumed dataset: ${datasetName}\nDeclared value: ${dataset.declaredValue}\nResumed at: ${new Date().toISOString()}\n`
    )
    const minSize = dataset.sizeBytes || fileData.length
    const padded = new Uint8Array(minSize)
    padded.set(fileData)
    for (let i = fileData.length; i < minSize; i++) {
      padded[i] = 0x20
    }
    const sizeBytes = padded.length

    const pieceCid = await Piece.calculate(padded)

    await SP.uploadPiece({
      data: padded,
      serviceURL: provider.pdp.serviceURL,
      pieceCid,
    })

    await SP.findPiece({
      pieceCid,
      serviceURL: provider.pdp.serviceURL,
      poll: true,
    })

    const rsp = await SP.createDataSetAndAddPieces(client, {
      serviceURL: provider.pdp.serviceURL,
      payee: provider.payee,
      pieces: [
        {
          pieceCid,
          metadata: { name: datasetName },
        },
      ],
    })

    const createdDataset = await SP.waitForCreateDataSetAddPieces({
      statusUrl: rsp.statusUrl,
    })

    result.newDatasetId = createdDataset.dataSetId.toString()
    result.txHash = rsp.txHash
    result.status = 'completed'

    const updated = datasets.map((d: any) =>
      d.datasetId === datasetId
        ? { ...d, status: 'active', datasetId: createdDataset.dataSetId.toString(), pieceCid: pieceCid.toString() }
        : d
    )
    saveDatasets(updated)
  } catch (err) {
    result.status = 'failed'
    result.error = err instanceof Error ? err.message : String(err)
  }

  appendIntervention(result)
  return result
}

async function getApprovedPDPProviders() {
  const { getApprovedPDPProviders } = await import('@filoz/synapse-core/sp-registry')
  return await getApprovedPDPProviders(client)
}
