import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as Piece from '@filoz/synapse-core/piece'
import * as SP from '@filoz/synapse-core/sp'
import { getApprovedPDPProviders } from '@filoz/synapse-core/sp-registry'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRIVATE_KEY = process.env.SYNAPSE_PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('ERROR: SYNAPSE_PRIVATE_KEY environment variable is not set.')
  process.exit(1)
}

const normalizedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`

// CONFIG: simulated declared values and cost model
const COST_PER_BYTE_PER_EPOCH = BigInt(100000000000000) // 1e-13 USDFC per byte per epoch (SIMULATED)
const DATASETS = [
  { name: 'customer-model-v3.txt', declaredValue: 9 },
  { name: 'raw-sensor-archive.txt', declaredValue: 3 },
] as const

function computeCostPerEpoch(sizeBytes: number): bigint {
  return BigInt(sizeBytes) * COST_PER_BYTE_PER_EPOCH
}

async function main() {
  const account = privateKeyToAccount(normalizedKey as `0x${string}`)

  const client = createClient({
    chain: calibrationChain,
    transport: http('https://api.calibration.node.glif.io/rpc/v1'),
    account,
  })

  const synapse = new Synapse({
    client,
    source: 'proofmarket-upload',
  })

  console.log('=== ProofMarket: Upload Datasets ===')
  console.log(`Wallet address: ${account.address}`)
  console.log('')

  // Select a provider automatically (first approved PDP provider)
  console.log('Fetching approved PDP providers...')
  const providers = await getApprovedPDPProviders(client)

  if (providers.length === 0) {
    throw new Error('No approved PDP providers found')
  }

  console.log(`Approved providers: ${providers.map(p => `#${p.id} ${p.pdp.serviceURL}`).join(', ')}`)

  let provider = providers[0]
  console.log(`Trying provider: #${provider.id} - ${provider.pdp.serviceURL}`)
  console.log('')

  const results: Array<{
    name: string
    declaredValue: number
    sizeBytes: number
    costPerEpoch: bigint
    datasetId: bigint
    pieceCid: string
  }> = []

  for (const dataset of DATASETS) {
    console.log(`--- Uploading ${dataset.name} ---`)

    // Create small test file content (padded to meet minimum 127-byte upload size)
    const baseContent = `ProofMarket test dataset: ${dataset.name}\nDeclared value: ${dataset.declaredValue}\nGenerated: ${new Date().toISOString()}\n`
    const padding = 'x'.repeat(Math.max(0, 127 - baseContent.length))
    const content = baseContent + padding
    const fileData = new TextEncoder().encode(content)
    const sizeBytes = fileData.length

    const pieceCid = await Piece.calculate(fileData)

    console.log(`  PieceCID: ${pieceCid}`)
    console.log(`  Size: ${sizeBytes} bytes`)

    let uploadError: Error | null = null
    for (const p of providers) {
      try {
        console.log(`  Trying provider #${p.id} (${p.pdp.serviceURL})...`)
        await SP.uploadPiece({
          data: fileData,
          serviceURL: p.pdp.serviceURL,
          pieceCid,
        })

        await SP.findPiece({
          pieceCid,
          serviceURL: p.pdp.serviceURL,
          poll: true,
        })

        console.log('  Piece uploaded and verified.')
        provider = p
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  Provider #${p.id} failed: ${msg}`)
        uploadError = err instanceof Error ? err : new Error(msg)
        continue
      }
    }

    if (uploadError && !provider) {
      throw uploadError
    }

    const rsp = await SP.createDataSetAndAddPieces(client, {
      serviceURL: provider.pdp.serviceURL,
      payee: provider.payee,
      pieces: [
        {
          pieceCid,
          metadata: { name: dataset.name },
        },
      ],
    })

    console.log(`  Waiting for tx ${rsp.txHash}...`)

    const createdDataset = await SP.waitForCreateDataSetAddPieces({
      statusUrl: rsp.statusUrl,
    })

    const costPerEpoch = computeCostPerEpoch(sizeBytes)

    console.log(`  Dataset created #${createdDataset.dataSetId}`)
    console.log(`  Declared value: ${dataset.declaredValue} (SIMULATED user-set priority, NOT onchain)`)
    console.log(`  Cost/epoch:     ${costPerEpoch.toString()} wei (SIMULATED, from size * ${COST_PER_BYTE_PER_EPOCH.toString()} wei/byte/epoch)`)
    console.log('')

    results.push({
      name: dataset.name,
      declaredValue: dataset.declaredValue,
      sizeBytes,
      costPerEpoch,
      datasetId: createdDataset.dataSetId,
      pieceCid: pieceCid.toString(),
    })
  }

  console.log('=== Upload Summary ===')
  for (const r of results) {
    console.log(`Dataset: ${r.name}`)
    console.log(`  ID:          ${r.datasetId.toString()}`)
    console.log(`  PieceCID:    ${r.pieceCid}`)
    console.log(`  Size:        ${r.sizeBytes} bytes`)
    console.log(`  Cost/epoch:  ${r.costPerEpoch.toString()} wei (SIMULATED)`)
    console.log('')
  }

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const datasetsPath = join(__dirname, '..', 'backend', 'data', 'datasets.json')
  const payload = results.map((r) => ({
    name: r.name,
    declaredValue: r.declaredValue,
    sizeBytes: r.sizeBytes,
    costPerEpoch: r.costPerEpoch.toString(),
    datasetId: r.datasetId.toString(),
    pieceCid: r.pieceCid,
    provider: 'https://calib2.ezpdpz.net',
    status: 'active',
  }))
  writeFileSync(datasetsPath, JSON.stringify(payload, null, 2))
  console.log(`Saved ${payload.length} dataset(s) to ${datasetsPath}`)

  return results
}

main().then((results) => {
  process.exit(0)
}).catch((err) => {
  console.error('Upload failed:', err)
  process.exit(1)
})
