import { useState, useEffect, useCallback } from 'react'
import type { AccountState, Dataset, DecisionResult, InterventionResult } from './types'

const API_BASE = 'http://localhost:3001'

function formatWei(wei: string, decimals = 18) {
  const value = Number(wei) / 10 ** decimals
  if (value === 0) return '0'
  if (value < 0.001) return '<0.001'
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals > 6 ? 6 : decimals })
}

function App() {
  const [account, setAccount] = useState<AccountState | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [latestDecision, setLatestDecision] = useState<DecisionResult | null>(null)
  const [decisions, setDecisions] = useState<DecisionResult[]>([])
  const [interventions, setInterventions] = useState<InterventionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/account`)
    if (!res.ok) throw new Error('Failed to fetch account')
    const data = await res.json()
    setAccount(data)
  }, [])

  const fetchDatasets = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/datasets`)
    if (!res.ok) throw new Error('Failed to fetch datasets')
    const data = await res.json()
    setDatasets(data)
  }, [])

  const fetchDecisions = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/decisions`)
    if (!res.ok) throw new Error('Failed to fetch decisions')
    const data = await res.json()
    setDecisions(data)
    setLatestDecision(data[data.length - 1] ?? null)
  }, [])

  const fetchInterventions = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/interventions`)
    if (!res.ok) throw new Error('Failed to fetch interventions')
    const data = await res.json()
    setInterventions(data)
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([fetchAccount(), fetchDatasets(), fetchDecisions(), fetchInterventions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [fetchAccount, fetchDatasets, fetchDecisions, fetchInterventions])

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/check`)
      if (!res.ok) throw new Error('Check failed')
      const decision = await res.json()
      setLatestDecision(decision)
      setDecisions((prev) => [...prev, decision])
      await fetchAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setLoading(false)
    }
  }

  const executeIntervention = async () => {
    if (!latestDecision?.pausedDataset) return
    setLoading(true)
    setError(null)
    try {
      const dataset = datasets.find((d) => d.name === latestDecision.pausedDataset)
      if (!dataset) throw new Error('Paused dataset not found')

      const res = await fetch(`${API_BASE}/api/act`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: dataset.datasetId, datasetName: dataset.name }),
      })
      if (!res.ok) throw new Error('Intervention failed')
      const result = await res.json()
      setInterventions((prev) => [...prev, result])
      setLatestDecision(null)
      await Promise.all([fetchDatasets(), fetchAccount(), fetchDecisions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intervention failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 30000)
    return () => clearInterval(interval)
  }, [refreshAll])

  const totalCostPerEpoch = Number(account?.lockupRate ?? 0)
  const remainingEpochs = account
    ? totalCostPerEpoch > 0
      ? Math.floor(Number(account.balance) / totalCostPerEpoch)
      : Number(account.runway)
    : null
  const threshold = 10000
  const isHealthy = latestDecision ? latestDecision.outcome === 'healthy' : remainingEpochs !== null && remainingEpochs >= threshold

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">ProofMarket</h1>
            <p className="text-gray-400">Autonomous Storage Budget Triage</p>
          </div>
          <button
            onClick={runCheck}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg font-medium transition"
          >
            {loading ? 'Checking...' : 'Check Now'}
          </button>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Account State
              </h2>
              {account ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">USDFC Balance</div>
                    <div className="text-xl font-mono">{formatWei(account.balance)} USDFC</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Runway</div>
                    <div className="text-xl font-mono">{Number(account.runway).toLocaleString()} epochs</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lockup Rate</div>
                    <div className="text-xl font-mono">{formatWei(account.lockupRate)} USDFC/epoch</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Current Epoch</div>
                    <div className="text-xl font-mono">{Number(account.currentEpoch).toLocaleString()}</div>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-500">Chain Verification</div>
                    <div className="text-sm text-gray-300 font-mono mt-1">
                      Balance: {formatWei(account.balance)} USDFC &nbsp;|&nbsp; Epoch: {account.currentEpoch}
                    </div>
                    <div className="text-sm text-gray-300 font-mono">
                      Runway: {Number(account.runway).toLocaleString()} epochs &nbsp;|&nbsp; Lockup: {formatWei(account.lockupRate)}/epoch
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Loading...</div>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Portfolio Summary
              </h2>
              {account ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Total Cost / Epoch</div>
                    <div className="text-xl font-mono">{formatWei(totalCostPerEpoch.toString())} USDFC</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Remaining Epochs (est.)</div>
                    <div className="text-xl font-mono">
                      {remainingEpochs !== null ? remainingEpochs.toLocaleString() : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Triage Threshold</div>
                    <div className="text-xl font-mono">10,000 epochs</div>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-500">Status</div>
                    <div
                      className={`text-sm font-medium mt-1 ${
                        isHealthy ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {account ? (isHealthy ? 'HEALTHY' : 'CRITICAL') : 'PENDING CHECK'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Loading...</div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Latest Decision
            </h2>
            {latestDecision ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Outcome</div>
                  <div
                    className={`text-lg font-semibold ${
                      latestDecision.outcome === 'critical' ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {latestDecision.outcome.toUpperCase()}
                  </div>
                </div>
                {latestDecision.protectedDataset && (
                  <div>
                    <div className="text-xs text-gray-500">Protected</div>
                    <div className="text-sm font-medium text-green-300">{latestDecision.protectedDataset}</div>
                  </div>
                )}
                {latestDecision.pausedDataset && (
                  <div>
                    <div className="text-xs text-gray-500">Paused / Dropped</div>
                    <div className="text-sm font-medium text-red-300">{latestDecision.pausedDataset}</div>
                  </div>
                )}
                {latestDecision.outcome === 'critical' && latestDecision.pausedDataset && (() => {
                  const alreadyPaused = datasets.some(
                    (d) => d.name === latestDecision.pausedDataset && d.status === 'paused'
                  )
                  if (alreadyPaused) {
                    return (
                      <div className="pt-3 border-t border-gray-700">
                        <div className="text-xs text-yellow-400 font-medium">Intervention already executed</div>
                        <p className="text-xs text-gray-500 mt-1">
                          {latestDecision.pausedDataset} has been paused on-chain.
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div className="pt-3 border-t border-gray-700">
                      <button
                        onClick={executeIntervention}
                        disabled={loading}
                        className="w-full px-3 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 rounded-lg text-sm font-medium transition"
                      >
                        {loading ? 'Pausing...' : `Pause ${latestDecision.pausedDataset}`}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        This will terminate the dataset on-chain via Synapse.
                      </p>
                    </div>
                  )
                })()}
                <div>
                  <div className="text-xs text-gray-500">Reason</div>
                  <div className="text-sm text-gray-300">{latestDecision.reason}</div>
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500">Checked At</div>
                  <div className="text-sm text-gray-300 font-mono">
                    {new Date(latestDecision.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No checks yet. Click "Check Now".</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {datasets.map((ds) => (
            <div key={ds.datasetId} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{ds.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    ds.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                  }`}
                >
                  {ds.status.toUpperCase()}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Declared Value</span>
                  <span className="text-gray-200 font-mono">{ds.declaredValue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span className="text-gray-200 font-mono">{ds.sizeBytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost / Epoch</span>
                  <span className="text-gray-200 font-mono">{formatWei(ds.costPerEpoch)} USDFC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dataset ID</span>
                  <span className="text-gray-200 font-mono">#{ds.datasetId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">PieceCID</span>
                  <span className="text-gray-200 font-mono text-xs truncate max-w-[180px]">{ds.pieceCid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider</span>
                  <span className="text-gray-200 font-mono text-xs truncate max-w-[180px]">{ds.provider}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Claude Explanation
            </h2>
            {latestDecision?.explanation ? (
              <p className="text-gray-200 leading-relaxed">{latestDecision.explanation}</p>
            ) : (
              <p className="text-gray-500">No explanation yet. Run a check to generate one.</p>
            )}
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Decision Log
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {decisions.length === 0 && (
                <p className="text-gray-500 text-sm">No decisions recorded yet.</p>
              )}
              {[...decisions].reverse().map((d, idx) => (
                <div key={d.timestamp + idx} className="border-b border-gray-700 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        d.outcome === 'critical' ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {d.outcome.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(d.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">{d.reason}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Intervention Log
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interventions.length === 0 && (
                <p className="text-gray-500 text-sm">No interventions executed yet.</p>
              )}
              {[...interventions].reverse().map((item, idx) => (
                <div key={item.timestamp + idx} className="border-b border-gray-700 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        item.status === 'completed' ? 'text-green-400' : item.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Paused <span className="text-red-300 font-medium">{item.datasetName}</span> #{item.datasetId}
                  </div>
                  {item.txHash && (
                    <div className="text-xs text-gray-500 font-mono mt-1 truncate">tx: {item.txHash}</div>
                  )}
                  {item.endEpoch && (
                    <div className="text-xs text-gray-500">endEpoch: {item.endEpoch}</div>
                  )}
                  {item.error && (
                    <div className="text-xs text-red-400 mt-1">{item.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
