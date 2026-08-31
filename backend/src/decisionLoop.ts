import { getAccountState, getBalance, getRunway } from './paymentsClient.ts'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type Dataset = {
  name: string
  declaredValue: number
  sizeBytes: number
  costPerEpoch: string
  datasetId: string
  pieceCid: string
  provider: string
  status: string
}

export type DecisionOutcome = 'healthy' | 'critical'

export type DecisionResult = {
  timestamp: string
  outcome: DecisionOutcome
  balance: string
  runway: string
  lockupRate: string
  currentEpoch: string
  totalCostPerEpoch: string
  remainingEpochs: string
  threshold: string
  protectedDataset: string | null
  pausedDataset: string | null
  reason: string
  explanation?: string
}

// CONFIG: tune during Day 7 calibration
export const TRIAGE_THRESHOLD_EPOCHS = 10000

function loadDatasets(): Dataset[] {
  const path = join(__dirname, '..', 'data', 'datasets.json')
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as Dataset[]
}

function appendDecision(decision: DecisionResult) {
  const path = join(__dirname, '..', 'data', 'decisions.json')
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : []
  existing.push(decision)
  writeFileSync(path, JSON.stringify(existing, null, 2))
}

export async function runDecisionLoop(): Promise<DecisionResult> {
  const state = await getAccountState()
  const datasets = loadDatasets()

  const activeDatasets = datasets.filter((d) => d.status === 'active')
  const totalCostPerEpoch = activeDatasets.reduce((sum, d) => sum + BigInt(d.costPerEpoch), 0n)
  const remainingEpochs = state.runway

  const isCritical = remainingEpochs < BigInt(TRIAGE_THRESHOLD_EPOCHS) && activeDatasets.length > 1

  let protectedDataset: string | null = null
  let pausedDataset: string | null = null
  let reason = ''

  if (isCritical) {
    const sorted = [...activeDatasets].sort((a, b) => b.declaredValue - a.declaredValue)
    const [higher, lower] = sorted

    protectedDataset = higher.name
    pausedDataset = lower.name

    reason = `Runway ${remainingEpochs.toString()} epochs is below threshold ${TRIAGE_THRESHOLD_EPOCHS}. ` +
      `Protected ${higher.name} (declared_value=${higher.declaredValue}) over ${lower.name} (declared_value=${lower.declaredValue}) by priority.`
  } else if (activeDatasets.length <= 1) {
    reason = `Only ${activeDatasets.length} active dataset(s). No triage needed.`
  } else {
    reason = `Runway ${remainingEpochs.toString()} epochs is above threshold ${TRIAGE_THRESHOLD_EPOCHS}. No action needed.`
  }

  const result: DecisionResult = {
    timestamp: new Date().toISOString(),
    outcome: isCritical ? 'critical' : 'healthy',
    balance: state.balance.toString(),
    runway: state.runway.toString(),
    lockupRate: state.lockupRate.toString(),
    currentEpoch: state.currentEpoch.toString(),
    totalCostPerEpoch: totalCostPerEpoch.toString(),
    remainingEpochs: remainingEpochs.toString(),
    threshold: BigInt(TRIAGE_THRESHOLD_EPOCHS).toString(),
    protectedDataset,
    pausedDataset,
    reason,
  }

  appendDecision(result)
  return result
}
