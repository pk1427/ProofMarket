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
  outcome: 'healthy' | 'critical' | 'resume_safe' | 'resume_available' | 'resume_insufficient'
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

export type TransactionKind = 'deposit' | 'withdraw' | 'pause' | 'resume'

export type TransactionEntry = {
  id: string
  timestamp: string
  kind: TransactionKind
  label: string
  detail?: string
  amountUSDFC?: string
  txHash?: string
  status: 'pending' | 'completed' | 'failed'
  error?: string
}
