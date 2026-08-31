import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { getAccountState, getBalance, getRunway } from './paymentsClient.ts'
import { runDecisionLoop, type Dataset, type DecisionResult } from './decisionLoop.ts'
import { generateExplanation, generateFallbackExplanation, type ExplanationInput } from './explain.ts'
import { pauseDataset, type InterventionResult } from './intervention.ts'
import * as SP from '@filoz/synapse-core/sp'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Origin not allowed'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

const DATA_DIR = join(__dirname, '..', 'data')
const DATASETS_FILE = join(DATA_DIR, 'datasets.json')
const DECISIONS_FILE = join(DATA_DIR, 'decisions.json')
const INTERVENTIONS_FILE = join(DATA_DIR, 'interventions.json')

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

app.get('/api/interventions', (_req, res) => {
  try {
    ensureDataDir()
    if (!existsSync(INTERVENTIONS_FILE)) {
      return res.json([])
    }
    const raw = readFileSync(INTERVENTIONS_FILE, 'utf-8')
    res.json(JSON.parse(raw))
  } catch (err) {
    console.error('GET /api/interventions error:', err)
    res.status(500).json({ error: 'Failed to read interventions' })
  }
})

app.post('/api/act', async (req, res) => {
  try {
    const { datasetId, datasetName } = req.body ?? {}
    if (!datasetId || !datasetName) {
      return res.status(400).json({ error: 'datasetId and datasetName are required' })
    }

    const numericId = BigInt(datasetId)
    if (numericId <= 0n) {
      return res.status(400).json({ error: 'Invalid datasetId' })
    }

    const result = await pauseDataset(datasetId, datasetName)
    res.json(result)
  } catch (err) {
    console.error('POST /api/act error:', err)
    res.status(500).json({ error: 'Intervention failed' })
  }
})

app.get('/api/verify-pause/:datasetId', async (req, res) => {
  try {
    const datasetId = req.params.datasetId
    const datasets = loadDatasets()
    const dataset = datasets.find((d) => d.datasetId === datasetId)

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' })
    }

    try {
      await SP.findPiece({
        pieceCid: dataset.pieceCid as any,
        serviceURL: dataset.provider,
        poll: false,
      })
      res.json({ accessible: true, message: 'Piece is still accessible on provider' })
    } catch (err) {
      res.json({
        accessible: false,
        message: 'Piece not found on provider — pause/termination confirmed',
      })
    }
  } catch (err) {
    console.error('GET /api/verify-pause error:', err)
    res.status(500).json({ error: 'Verification failed' })
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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

app.listen(PORT, () => {
  console.log(`ProofMarket backend listening on http://localhost:${PORT}`)
  console.log(`  GET  /api/account`)
  console.log(`  GET  /api/datasets`)
  console.log(`  POST /api/datasets`)
  console.log(`  GET  /api/check`)
  console.log(`  GET  /api/decisions`)
  console.log(`  GET  /api/interventions`)
  console.log(`  POST /api/act`)
  console.log(`  GET  /api/verify-pause/:datasetId`)
})
