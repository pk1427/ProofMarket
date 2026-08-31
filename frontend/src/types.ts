export type AccountState = {
  balance: string
  runway: string
  lockupRate: string
  currentEpoch: string
}

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

export type DecisionResult = {
  timestamp: string
  outcome: 'healthy' | 'critical'
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
