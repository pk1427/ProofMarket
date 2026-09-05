import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { getAccountState, getBalance, getRunway, createPaymentsClient, waitForReceipt } from './paymentsClient.ts'
import { runDecisionLoop, type Dataset, type DecisionResult } from './decisionLoop.ts'
import { generateExplanation, generateFallbackExplanation, type ExplanationInput } from './explain.ts'
import { pauseDataset, resumeDataset, type InterventionResult } from './intervention.ts'
import * as SP from '@filoz/synapse-core/sp'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()

const localOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : localOrigins

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

app.get('/api/datasets', (req, res) => {
  try {
    ensureDataDir()
    const address = (req.query.address as string)?.toLowerCase()
    if (address) {
      const path = join(DATA_DIR, `datasets-${address}.json`)
      if (!existsSync(path)) return res.json([])
      const raw = readFileSync(path, 'utf-8')
      return res.json(JSON.parse(raw))
    }
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
    const address = (req.body?.address as string)?.toLowerCase()
    const datasets = Array.isArray(req.body?.datasets) ? req.body.datasets : (Array.isArray(req.body) ? req.body : [req.body])
    if (address) {
      const path = join(DATA_DIR, `datasets-${address}.json`)
      writeFileSync(path, JSON.stringify(datasets, null, 2))
      return res.json({ success: true, count: datasets.length, scope: address })
    }
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

app.get('/api/interventions', (req, res) => {
  try {
    ensureDataDir()
    const address = (req.query.address as string)?.toLowerCase()
    const file = address
      ? join(DATA_DIR, `interventions-${address}.json`)
      : INTERVENTIONS_FILE
    if (!existsSync(file)) {
      return res.json([])
    }
    const raw = readFileSync(file, 'utf-8')
    res.json(JSON.parse(raw))
  } catch (err) {
    console.error('GET /api/interventions error:', err)
    res.status(500).json({ error: 'Failed to read interventions' })
  }
})

app.post('/api/interventions', (req, res) => {
  try {
    ensureDataDir()
    const address = (req.body?.address as string)?.toLowerCase()
    const entry = req.body?.entry
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ error: 'entry is required' })
    }
    const file = address
      ? join(DATA_DIR, `interventions-${address}.json`)
      : INTERVENTIONS_FILE
    const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : []
    existing.push(entry)
    writeFileSync(file, JSON.stringify(existing, null, 2))
    res.json({ success: true, scope: address ?? 'demo' })
  } catch (err) {
    console.error('POST /api/interventions error:', err)
    res.status(500).json({ error: 'Failed to write intervention' })
  }
})

app.post('/api/act', async (req, res) => {
  try {
    const { datasetId, datasetName, address } = req.body ?? {}
    if (!datasetId || !datasetName) {
      return res.status(400).json({ error: 'datasetId and datasetName are required' })
    }

    const numericId = BigInt(datasetId)
    if (numericId <= 0n) {
      return res.status(400).json({ error: 'Invalid datasetId' })
    }

    const result = await pauseDataset(datasetId, datasetName, address?.toLowerCase())
    res.json(result)
  } catch (err) {
    console.error('POST /api/act error:', err)
    res.status(500).json({ error: 'Intervention failed' })
  }
})

app.post('/api/resume', async (req, res) => {
  try {
    const { datasetId, datasetName, address } = req.body ?? {}
    if (!datasetId || !datasetName) {
      return res.status(400).json({ error: 'datasetId and datasetName are required' })
    }

    const numericId = BigInt(datasetId)
    if (numericId <= 0n) {
      return res.status(400).json({ error: 'Invalid datasetId' })
    }

    const result = await resumeDataset(datasetId, datasetName, address?.toLowerCase())
    res.json(result)
  } catch (err) {
    console.error('POST /api/resume error:', err)
    res.status(500).json({ error: 'Resume failed' })
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
        outcome: decision.outcome as any,
        balance: decision.balance,
        runway: decision.runway,
        lockupRate: decision.lockupRate,
        currentEpoch: decision.currentEpoch,
        totalCostPerEpoch: decision.totalCostPerEpoch,
        remainingEpochs: decision.remainingEpochs,
        threshold: decision.threshold,
        protectedDataset: decision.protectedDataset,
        pausedDataset: decision.pausedDataset,
        resumeCandidate: decision.resumeCandidate,
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
        outcome: decision.outcome as any,
        balance: decision.balance,
        runway: decision.runway,
        lockupRate: decision.lockupRate,
        currentEpoch: decision.currentEpoch,
        totalCostPerEpoch: decision.totalCostPerEpoch,
        remainingEpochs: decision.remainingEpochs,
        threshold: decision.threshold,
        protectedDataset: decision.protectedDataset,
        pausedDataset: decision.pausedDataset,
        resumeCandidate: decision.resumeCandidate,
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

app.post('/api/deposit', async (req, res) => {
  try {
    const amountWei = req.body?.amount ? BigInt(req.body.amount) : 10_000_000_000_000_000_000n
    if (amountWei <= 0n) {
      return res.status(400).json({ error: 'amount must be > 0 (wei)' })
    }

    const { synapse, publicClient } = createPaymentsClient()
    const before = await synapse.payments.walletBalance({ token: TOKENS.USDFC })
    if (before < amountWei) {
      return res.status(400).json({
        error: `Insufficient wallet balance: have ${before.toString()} wei, need ${amountWei.toString()} wei`,
      })
    }

    const warmStorageAddress = calibrationChain.contracts.fwss.address
    const approveTxHash = await synapse.payments.approveService({
      service: warmStorageAddress,
      rateAllowance: amountWei,
      lockupAllowance: amountWei,
      maxLockupPeriod: 100_000n,
      token: TOKENS.USDFC,
    })
    const depositTxHash = await synapse.payments.deposit({
      amount: amountWei,
      token: TOKENS.USDFC,
    })

    const approveReceipt = await waitForReceipt(publicClient, approveTxHash as `0x${string}`)
    const depositReceipt = await waitForReceipt(publicClient, depositTxHash as `0x${string}`)

    const after = await synapse.payments.accountSummary({ token: TOKENS.USDFC })

    res.json({
      action: 'deposit',
      status: 'completed',
      amount: amountWei.toString(),
      amountUSDFC: Number(amountWei) / 1e18,
      walletBalanceBefore: before.toString(),
      walletBalanceAfterUSDFC: Number(before - amountWei) / 1e18,
      paymentsBalanceAfter: after.availableFunds.toString(),
      paymentsBalanceAfterUSDFC: Number(after.availableFunds) / 1e18,
      runwayAfter: after.runwayInEpochs.toString(),
      approveTxHash,
      depositTxHash,
      approveBlockNumber: approveReceipt.blockNumber.toString(),
      depositBlockNumber: depositReceipt.blockNumber.toString(),
    })
  } catch (err) {
    console.error('POST /api/deposit error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deposit failed' })
  }
})

app.post('/api/withdraw', async (req, res) => {
  try {
    const amountWei = req.body?.amount ? BigInt(req.body.amount) : null
    if (amountWei !== null && amountWei <= 0n) {
      return res.status(400).json({ error: 'amount must be > 0 (wei)' })
    }

    const { synapse, publicClient } = createPaymentsClient()
    const before = await synapse.payments.accountSummary({ token: TOKENS.USDFC })

    const amount = amountWei ?? before.availableFunds / 10n
    if (amount > before.availableFunds) {
      return res.status(400).json({
        error: `Insufficient payments balance: have ${before.availableFunds.toString()} wei, requested ${amount.toString()} wei`,
      })
    }

    const txHash = await synapse.payments.withdraw({
      amount,
      token: TOKENS.USDFC,
    })

    const receipt = await waitForReceipt(publicClient, txHash as `0x${string}`)

    const after = await synapse.payments.accountSummary({ token: TOKENS.USDFC })

    res.json({
      action: 'withdraw',
      status: 'completed',
      amount: amount.toString(),
      amountUSDFC: Number(amount) / 1e18,
      paymentsBalanceBefore: before.availableFunds.toString(),
      paymentsBalanceAfter: after.availableFunds.toString(),
      paymentsBalanceAfterUSDFC: Number(after.availableFunds) / 1e18,
      runwayAfter: after.runwayInEpochs.toString(),
      txHash,
      blockNumber: receipt.blockNumber.toString(),
    })
  } catch (err) {
    console.error('POST /api/withdraw error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Withdrawal failed' })
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
  console.log(`  POST /api/interventions`)
  console.log(`  POST /api/act`)
  console.log(`  POST /api/resume`)
  console.log(`  GET  /api/verify-pause/:datasetId`)
})
