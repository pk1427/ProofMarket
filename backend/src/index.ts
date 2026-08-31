import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { getAccountState, getBalance, getRunway } from './paymentsClient.ts'
import { runDecisionLoop, type Dataset, type DecisionResult } from './decisionLoop.ts'
import { generateExplanation, generateFallbackExplanation, type ExplanationInput } from './explain.ts'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

const DATA_DIR = join(__dirname, '..', 'data')
const DATASETS_FILE = join(DATA_DIR, 'datasets.json')
const DECISIONS_FILE = join(DATA_DIR, 'decisions.json')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadDatasets(): Dataset[] {
  if (!existsSync(DATASETS_FILE)) return []
  const raw = readFileSync(DATASETS_FILE, 'utf-8')
  return JSON.parse(raw) as Dataset[]
}

function appendDecision(decision: DecisionResult) {
  const existing = existsSync(DECISIONS_FILE) ? JSON.parse(readFileSync(DECISIONS_FILE, 'utf-8')) : []
  existing.push(decision)
  writeFileSync(DECISIONS_FILE, JSON.stringify(existing, null, 2))
}

app.get('/api/account', async (_req, res) => {
  try {
    const state = await getAccountState()
    res.json({
      balance: state.balance.toString(),
      runway: state.runway.toString(),
      lockupRate: state.lockupRate.toString(),
      currentEpoch: state.currentEpoch.toString(),
    })
  } catch (err) {
    console.error('GET /api/account error:', err)
    res.status(500).json({ error: 'Failed to fetch account state' })
  }
})

app.get('/api/datasets', (_req, res) => {
  try {
    ensureDataDir()
    if (!existsSync(DATASETS_FILE)) {
      return res.json([])
    }
    const raw = readFileSync(DATASETS_FILE, 'utf-8')
    res.json(JSON.parse(raw))
  } catch (err) {
    console.error('GET /api/datasets error:', err)
    res.status(500).json({ error: 'Failed to read datasets' })
  }
})

app.post('/api/datasets', (req, res) => {
  try {
    ensureDataDir()
    const datasets = Array.isArray(req.body) ? req.body : [req.body]
    writeFileSync(DATASETS_FILE, JSON.stringify(datasets, null, 2))
    res.json({ success: true, count: datasets.length })
  } catch (err) {
    console.error('POST /api/datasets error:', err)
    res.status(500).json({ error: 'Failed to write datasets' })
  }
})

app.get('/api/decisions', (_req, res) => {
  try {
    ensureDataDir()
    if (!existsSync(DECISIONS_FILE)) {
      return res.json([])
    }
    const raw = readFileSync(DECISIONS_FILE, 'utf-8')
    res.json(JSON.parse(raw))
  } catch (err) {
    console.error('GET /api/decisions error:', err)
    res.status(500).json({ error: 'Failed to read decisions' })
  }
})

app.get('/api/check', async (_req, res) => {
  try {
    const decision = await runDecisionLoop()
    const datasets = loadDatasets()

    let explanation: string | undefined
    try {
      const input: ExplanationInput = {
        outcome: decision.outcome,
        balance: decision.balance,
        runway: decision.runway,
        lockupRate: decision.lockupRate,
        currentEpoch: decision.currentEpoch,
        totalCostPerEpoch: decision.totalCostPerEpoch,
        remainingEpochs: decision.remainingEpochs,
        threshold: decision.threshold,
        protectedDataset: decision.protectedDataset,
        pausedDataset: decision.pausedDataset,
        reason: decision.reason,
        datasets: datasets.map(d => ({
          name: d.name,
          declaredValue: d.declaredValue,
          costPerEpoch: d.costPerEpoch,
        })),
      }
      explanation = await generateExplanation(input)
    } catch (err) {
      console.error('Claude explanation failed, using fallback:', err)
      const input: ExplanationInput = {
        outcome: decision.outcome,
        balance: decision.balance,
        runway: decision.runway,
        lockupRate: decision.lockupRate,
        currentEpoch: decision.currentEpoch,
        totalCostPerEpoch: decision.totalCostPerEpoch,
        remainingEpochs: decision.remainingEpochs,
        threshold: decision.threshold,
        protectedDataset: decision.protectedDataset,
        pausedDataset: decision.pausedDataset,
        reason: decision.reason,
        datasets: datasets.map(d => ({
          name: d.name,
          declaredValue: d.declaredValue,
          costPerEpoch: d.costPerEpoch,
        })),
      }
      explanation = generateFallbackExplanation(input)
    }

    decision.explanation = explanation
    appendDecision(decision)

    res.json(decision)
  } catch (err) {
    console.error('GET /api/check error:', err)
    res.status(500).json({ error: 'Decision check failed' })
  }
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

app.listen(PORT, () => {
  console.log(`ProofMarket backend listening on http://localhost:${PORT}`)
  console.log(`  GET  /api/account`)
  console.log(`  GET  /api/datasets`)
  console.log(`  POST /api/datasets`)
  console.log(`  GET  /api/check`)
})
