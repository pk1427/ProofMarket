import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { getAccountState, getBalance, getRunway } from './paymentsClient.ts'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

const DATA_DIR = join(__dirname, '..', 'data')
const DATASETS_FILE = join(DATA_DIR, 'datasets.json')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

app.listen(PORT, () => {
  console.log(`ProofMarket backend listening on http://localhost:${PORT}`)
  console.log(`  GET  /api/account`)
  console.log(`  GET  /api/datasets`)
  console.log(`  POST /api/datasets`)
})
