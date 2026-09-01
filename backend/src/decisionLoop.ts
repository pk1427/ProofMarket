import { getAccountState, createPaymentsClient } from './paymentsClient.ts'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getRail } from '@filoz/synapse-core/pay'
import { calculateEffectiveRate, getPriceList } from '@filoz/synapse-core/warm-storage'

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
  pdpRailId?: string
}

export type DecisionOutcome = 'healthy' | 'critical' | 'resume_available' | 'resume_safe' | 'resume_insufficient'

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
  resumeCandidate: string | null
  reason: string
  explanation?: string
}

export const TRIAGE_THRESHOLD_EPOCHS = Number(process.env.TRIAGE_THRESHOLD_EPOCHS ?? 100_000_000)
export const RESUME_MARGIN_EPOCHS = Number(process.env.RESUME_MARGIN_EPOCHS ?? 10_000_000)

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

async function getDatasetRailRate(client: Awaited<ReturnType<typeof createPaymentsClient>>['client'], dataset: Dataset): Promise<bigint> {
  if (dataset.pdpRailId) {
    try {
      const rail = await getRail(client, { railId: BigInt(dataset.pdpRailId) })
      return rail.paymentRate
    } catch {
      // fall through to estimate
    }
  }

  const priceList = await getPriceList(client)
  const epochsPerMonth = priceList.lockups.defaultLockupPeriod
  const effective = calculateEffectiveRate({
    sizeInBytes: BigInt(dataset.sizeBytes),
    storagePerTibPerMonth: priceList.rates.storagePerTibPerMonth,
    datasetFeePerMonth: priceList.rates.datasetFeePerMonth,
    epochsPerMonth: epochsPerMonth,
  })
  return effective.ratePerEpoch
}

export async function runDecisionLoop(): Promise<DecisionResult> {
  const state = await getAccountState()
  const datasets = loadDatasets()
  const { client } = createPaymentsClient()

  const activeDatasets = datasets.filter((d) => d.status === 'active')
  const pausedDatasets = datasets.filter((d) => d.status === 'paused')

  const activeRates = await Promise.all(activeDatasets.map((d) => getDatasetRailRate(client, d)))
  const totalActiveCostPerEpoch = activeRates.reduce((sum, rate) => sum + rate, 0n)

  const pausedRates = await Promise.all(pausedDatasets.map((d) => getDatasetRailRate(client, d)))
  const totalPausedCostPerEpoch = pausedRates.reduce((sum, rate) => sum + rate, 0n)

  const remainingEpochs = state.runway

  const isCritical = remainingEpochs < BigInt(TRIAGE_THRESHOLD_EPOCHS) && activeDatasets.length > 1

  let protectedDataset: string | null = null
  let pausedDataset: string | null = null
  let resumeCandidate: string | null = null
  let outcome: DecisionOutcome = 'healthy'
  let reason = ''

  if (isCritical) {
    const sorted = [...activeDatasets].sort((a, b) => b.declaredValue - a.declaredValue)
    const [higher, lower] = sorted

    protectedDataset = higher.name
    pausedDataset = lower.name
    outcome = 'critical'

    reason = `Runway ${remainingEpochs.toString()} epochs is below threshold ${TRIAGE_THRESHOLD_EPOCHS}. ` +
      `Protected ${higher.name} (declared_value=${higher.declaredValue}) over ${lower.name} (declared_value=${lower.declaredValue}) by priority.`
  } else if (pausedDatasets.length > 0 && activeDatasets.length === 1) {
    const pausedRate = pausedRates[0]
    const projectedLockupRate = state.lockupRate + pausedRate
    const projectedRemainingEpochs = projectedLockupRate > 0n ? state.balance / projectedLockupRate : state.runway
    const safeThreshold = BigInt(TRIAGE_THRESHOLD_EPOCHS + RESUME_MARGIN_EPOCHS)

    if (projectedRemainingEpochs >= safeThreshold) {
      outcome = 'resume_safe'
      resumeCandidate = pausedDatasets[0].name
      reason = `Runway recovered to ${remainingEpochs.toString()} epochs. Resuming ${pausedDatasets[0].name} would leave ` +
        `${projectedRemainingEpochs.toString()} epochs projected, safely above the ${safeThreshold.toString()}-epoch safety margin.`
    } else if (projectedRemainingEpochs >= BigInt(TRIAGE_THRESHOLD_EPOCHS)) {
      outcome = 'resume_available'
      resumeCandidate = pausedDatasets[0].name
      reason = `Runway recovered to ${remainingEpochs.toString()} epochs, but resuming ${pausedDatasets[0].name} would only leave ` +
        `${projectedRemainingEpochs.toString()} projected epochs — above threshold but without the ${RESUME_MARGIN_EPOCHS}-epoch safety margin.`
    } else {
      outcome = 'resume_insufficient'
      reason = `Runway recovered to ${remainingEpochs.toString()} epochs, but that is still insufficient to safely resume ` +
        `${pausedDatasets[0].name}. Projected remaining after resume: ${projectedRemainingEpochs.toString()} epochs, below the ${TRIAGE_THRESHOLD_EPOCHS}-epoch threshold.`
    }
  } else if (activeDatasets.length <= 1 && pausedDatasets.length === 0) {
    reason = `Only ${activeDatasets.length} active dataset(s) and no paused datasets. No triage needed.`
  } else {
    reason = `Runway ${remainingEpochs.toString()} epochs is above threshold ${TRIAGE_THRESHOLD_EPOCHS}. No action needed.`
  }

  const result: DecisionResult = {
    timestamp: new Date().toISOString(),
    outcome,
    balance: state.balance.toString(),
    runway: state.runway.toString(),
    lockupRate: state.lockupRate.toString(),
    currentEpoch: state.currentEpoch.toString(),
    totalCostPerEpoch: totalActiveCostPerEpoch.toString(),
    remainingEpochs: remainingEpochs.toString(),
    threshold: BigInt(TRIAGE_THRESHOLD_EPOCHS).toString(),
    protectedDataset,
    pausedDataset,
    resumeCandidate,
    reason,
  }

  return result
}
