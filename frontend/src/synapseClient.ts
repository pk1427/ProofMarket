import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import {
  createWalletClient, custom, publicActions,
  type WalletClient, type Account, type Chain, type Transport,
  createPublicClient, http,
} from 'viem'
import * as SP from '@filoz/synapse-core/sp'
import * as Piece from '@filoz/synapse-core/piece'
import { getPdpDataSet, terminateServiceSync, extractPDPPaymentTerminatedEvent } from '@filoz/synapse-core/warm-storage'

export async function getSynapseForWallet(walletClient: WalletClient<Transport, Chain, Account>) {
  return new Synapse({
    client: walletClient,
    source: 'proofmarket-frontend',
  })
}

const publicClient = createPublicClient({
  chain: calibrationChain,
  transport: http('https://api.calibration.node.glif.io/rpc/v1'),
})

export async function getSynapseReadOnly() {
  return new Synapse({
    client: publicClient as any,
    source: 'proofmarket-frontend-readonly',
  })
}

export async function getWalletClientFromEIP1193(): Promise<WalletClient<Transport, Chain, Account> | null> {
  if (typeof window === 'undefined') return null
  const ethereum = (window as any).ethereum
  if (!ethereum) return null
  const account = (await ethereum.request({ method: 'eth_requestAccounts' })) as `0x${string}`[]
  if (!account || account.length === 0) return null
  return createWalletClient({
    chain: calibrationChain,
    transport: custom(ethereum),
    account: account[0],
  })
}

export async function readAccountViaSynapse(synapse: Synapse) {
  const summary = await synapse.payments.accountSummary({ token: TOKENS.USDFC })
  return {
    balance: summary.availableFunds.toString(),
    runway: summary.runwayInEpochs.toString(),
    lockupRate: summary.lockupRatePerEpoch.toString(),
    currentEpoch: summary.epoch.toString(),
  }
}

export function usdfcToWei(amountUSDFC: string): bigint {
  return BigInt(Math.floor(parseFloat(amountUSDFC) * 1e6)) * 10n ** 12n
}

export function formatUSDFC(wei: bigint, decimals = 6): string {
  const value = Number(wei) / 1e18
  if (value === 0) return '0'
  if (value < 0.001) return '<0.001'
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export type CreatedDataset = {
  name: string
  declaredValue: number
  sizeBytes: number
  costPerEpoch: string
  datasetId: string
  pieceCid: string
  provider: string
  status: string
  pdpRailId?: string
  txHash?: string
}

export async function createDemoDataset(
  walletClient: WalletClient<Transport, Chain, Account>,
  name: string,
  declaredValue: number,
  sizeBytes: number,
): Promise<CreatedDataset> {
  const minSize = Math.max(sizeBytes, 127)
  const padded = new Uint8Array(minSize)
  const text = new TextEncoder().encode(
    `ProofMarket demo dataset: ${name}\nDeclared value: ${declaredValue}\nCreated at: ${new Date().toISOString()}\n`
  )
  padded.set(text)
  for (let i = text.length; i < minSize; i++) padded[i] = 0x20

  const pieceCid = await Piece.calculate(padded)

  const registry = await import('@filoz/synapse-core/sp-registry')
  const { publicClient: pc } = createClientWithPublic(walletClient)
  const providers = await registry.getApprovedPDPProviders(pc as any)
  if (providers.length === 0) throw new Error('No approved PDP providers found on Calibration')
  const provider = providers[0]

  await SP.uploadPiece({ data: padded, serviceURL: provider.pdp.serviceURL, pieceCid })
  await SP.findPiece({ pieceCid, serviceURL: provider.pdp.serviceURL, poll: true })

  const rsp = await SP.createDataSetAndAddPieces(walletClient, {
    serviceURL: provider.pdp.serviceURL,
    payee: provider.payee,
    pieces: [{ pieceCid, metadata: { name } }],
  })

  const created = await SP.waitForCreateDataSetAddPieces({ statusUrl: rsp.statusUrl })

  return {
    name,
    declaredValue,
    sizeBytes: minSize,
    costPerEpoch: '12700000000000000',
    datasetId: created.dataSetId.toString(),
    pieceCid: pieceCid.toString(),
    provider: provider.pdp.serviceURL,
    status: 'active',
    txHash: rsp.txHash,
  }
}

function createClientWithPublic(walletClient: WalletClient<Transport, Chain, Account>) {
  return { publicClient: walletClient.extend(publicActions) }
}

export async function pauseDatasetViaWallet(
  walletClient: WalletClient<Transport, Chain, Account>,
  datasetId: string,
): Promise<{ txHash: string; endEpoch: string }> {
  const { publicClient } = createClientWithPublic(walletClient)
  await getPdpDataSet(publicClient as any, { dataSetId: BigInt(datasetId) })
  const { receipt } = await terminateServiceSync(publicClient as any, { dataSetId: BigInt(datasetId) })
  const event = extractPDPPaymentTerminatedEvent(receipt.logs)
  return {
    txHash: receipt.transactionHash,
    endEpoch: event.args.endEpoch.toString(),
  }
}

export async function resumeDatasetViaWallet(
  walletClient: WalletClient<Transport, Chain, Account>,
  name: string,
  declaredValue: number,
  sizeBytes: number,
): Promise<{ txHash: string; newDatasetId: string; pieceCid: string; provider: string }> {
  const minSize = Math.max(sizeBytes, 127)
  const padded = new Uint8Array(minSize)
  const text = new TextEncoder().encode(
    `ProofMarket resumed dataset: ${name}\nDeclared value: ${declaredValue}\nResumed at: ${new Date().toISOString()}\n`
  )
  padded.set(text)
  for (let i = text.length; i < minSize; i++) padded[i] = 0x20

  const pieceCid = await Piece.calculate(padded)
  const registry = await import('@filoz/synapse-core/sp-registry')
  const { publicClient } = createClientWithPublic(walletClient)
  const providers = await registry.getApprovedPDPProviders(publicClient as any)
  if (providers.length === 0) throw new Error('No approved PDP providers found')
  const provider = providers[0]

  await SP.uploadPiece({ data: padded, serviceURL: provider.pdp.serviceURL, pieceCid })
  await SP.findPiece({ pieceCid, serviceURL: provider.pdp.serviceURL, poll: true })

  const rsp = await SP.createDataSetAndAddPieces(walletClient, {
    serviceURL: provider.pdp.serviceURL,
    payee: provider.payee,
    pieces: [{ pieceCid, metadata: { name } }],
  })
  const created = await SP.waitForCreateDataSetAddPieces({ statusUrl: rsp.statusUrl })

  return {
    txHash: rsp.txHash,
    newDatasetId: created.dataSetId.toString(),
    pieceCid: pieceCid.toString(),
    provider: provider.pdp.serviceURL,
  }
}
