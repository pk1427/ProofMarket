import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { AccountState, Dataset, DecisionResult, InterventionResult } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

function formatWei(wei: string, decimals = 18) {
  const value = Number(wei) / 10 ** decimals
  if (value === 0) return '0'
  if (value < 0.001) return '<0.001'
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals > 6 ? 6 : decimals })
}

function SimulatedBadge() {
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/60 text-yellow-300 text-[10px] font-semibold rounded border border-yellow-700/60 uppercase tracking-wider">
      Simulated
    </span>
  )
}

function RealBadge() {
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold rounded border border-emerald-700/60 uppercase tracking-wider">
      Onchain
    </span>
  )
}

function ExplorerLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition ${className || ''}`}
    >
      {children}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

export default function Demo() {
  const [account, setAccount] = useState<AccountState | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [latestDecision, setLatestDecision] = useState<DecisionResult | null>(null)
  const [decisions, setDecisions] = useState<DecisionResult[]>([])
  const [interventions, setInterventions] = useState<InterventionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, { accessible: boolean; message: string }>>({})

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

  const resumeDataset = async () => {
    if (!latestDecision?.resumeCandidate) return
    setLoading(true)
    setError(null)
    try {
      const dataset = datasets.find((d) => d.name === latestDecision.resumeCandidate)
      if (!dataset) throw new Error('Resume candidate not found')

      const res = await fetch(`${API_BASE}/api/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: dataset.datasetId, datasetName: dataset.name }),
      })
      if (!res.ok) throw new Error('Resume failed')
      const result = await res.json()
      setInterventions((prev) => [...prev, result])
      setLatestDecision(null)
      await Promise.all([fetchDatasets(), fetchAccount(), fetchDecisions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume failed')
    } finally {
      setLoading(false)
    }
  }

  const verifyPause = async (datasetId: string) => {
    setVerifyingId(datasetId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/verify-pause/${datasetId}`)
      if (!res.ok) throw new Error('Verification failed')
      const result = await res.json()
      setVerifyResult((prev) => ({ ...prev, [datasetId]: result }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifyingId(null)
    }
  }

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 30000)
    return () => clearInterval(interval)
  }, [refreshAll])

  const remainingEpochs = account ? Number(account.runway) : null
  const threshold = latestDecision ? Number(latestDecision.threshold) : 100000000
  const healthyOutcomes = ['healthy', 'resume_safe', 'resume_available']
  const isHealthy = latestDecision ? healthyOutcomes.includes(latestDecision.outcome) : remainingEpochs !== null && remainingEpochs >= threshold
  const progress = remainingEpochs !== null ? Math.min(100, Math.max(0, (remainingEpochs / threshold) * 100)) : 0

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PM</span>
            </div>
            <span className="text-xl font-bold gradient-text-subtle">
              ProofMarket
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link to="/" className="nav-link">Home</Link>
            <span className="text-white font-medium">Live Demo</span>
            <Link to="/verification" className="nav-link">Verification</Link>
          </div>
          <a
            href="https://github.com/pk1427/ProofMarket"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
          >
            View Source
          </a>
        </div>
      </nav>

      {/* Demo Section */}
      <section id="demo" className="pt-32 pb-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Live Demo</h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8 text-lg">
              This dashboard is connected to a real Calibration testnet account.
              Every number you see is pulled from Filecoin Pay via the Synapse SDK.
            </p>
            <button
              onClick={runCheck}
              disabled={loading}
              className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-blue-500 to-purple-500 transition-transform duration-500 group-hover:translate-x-0" />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <span className="spinner" />
                    Checking...
                  </>
                ) : (
                  <>
                    Check Now
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700/50 rounded-xl text-red-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Top Status Bar */}
          {account && (
            <div className={`mb-8 p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
              isHealthy
                ? 'glass border-green-700/50'
                : 'glass border-red-700/50'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`relative flex h-4 w-4`}>
                  {isHealthy && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${
                    isHealthy ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${
                    isHealthy ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {isHealthy ? 'HEALTHY' : 'CRITICAL'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {remainingEpochs !== null ? `${remainingEpochs.toLocaleString()} epochs remaining` : 'Loading...'}
                  </div>
                </div>
              </div>
               
              <div className="flex-1 max-w-md">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Runway remaining</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isHealthy ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-orange-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">Triage Threshold</div>
                <div className="text-lg font-mono text-white">{threshold.toLocaleString()} epochs</div>
              </div>
            </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Account State */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-glass">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Account State</h3>
                {account ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">USDFC Balance</span>
                      <span className="text-2xl font-mono text-white">{formatWei(account.balance)} <span className="text-sm text-gray-500">USDFC</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Runway</span>
                      <span className="text-2xl font-mono text-white">{Number(account.runway).toLocaleString()} <span className="text-sm text-gray-500">epochs</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Lockup Rate</span>
                      <span className="text-2xl font-mono text-white">{formatWei(account.lockupRate)} <span className="text-sm text-gray-500">/epoch</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Current Epoch</span>
                      <span className="text-2xl font-mono text-white">{Number(account.currentEpoch).toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-800">
                      <div className="text-xs text-gray-500 mb-2">Chain Verification</div>
                      <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
                        <div>Balance: {formatWei(account.balance)} USDFC | Epoch: {account.currentEpoch}</div>
                        <div>Runway: {Number(account.runway).toLocaleString()} epochs | Lockup: {formatWei(account.lockupRate)}/epoch</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">Loading...</div>
                )}
              </div>

              <div className="card-glass">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Portfolio</h3>
                {account ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Cost / Epoch</span>
                      <span className="text-2xl font-mono text-white">{formatWei(account.lockupRate)} <span className="text-sm text-gray-500">USDFC</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Remaining Epochs</span>
                      <span className="text-2xl font-mono text-white">
                        {remainingEpochs !== null ? remainingEpochs.toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Threshold</span>
                      <span className="text-2xl font-mono text-white">{threshold.toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-800">
                      <div className="text-xs text-gray-500 mb-2">Status</div>
                      <div className={`text-lg font-semibold ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                        {isHealthy ? 'HEALTHY' : 'CRITICAL'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">Loading...</div>
                )}
              </div>
            </div>

            {/* Latest Decision */}
            <div className="card-glass">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Latest Decision</h3>
              {latestDecision ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Outcome</div>
                    <div className={`text-3xl font-bold ${
                      latestDecision.outcome === 'critical' ? 'text-red-400' :
                      latestDecision.outcome === 'resume_insufficient' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {latestDecision.outcome.toUpperCase()}
                    </div>
                  </div>
                   
                  {latestDecision.protectedDataset && (
                    <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-xl">
                      <div className="text-xs text-green-400 mb-1">Protected</div>
                      <div className="text-sm font-medium text-green-300">{latestDecision.protectedDataset}</div>
                    </div>
                  )}
                   
                  {latestDecision.pausedDataset && (
                    <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-xl">
                      <div className="text-xs text-red-400 mb-1">Paused / Dropped</div>
                      <div className="text-sm font-medium text-red-300">{latestDecision.pausedDataset}</div>
                    </div>
                  )}

                  {latestDecision.resumeCandidate && (
                    <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-xl">
                      <div className="text-xs text-blue-400 mb-1">Resume Candidate</div>
                      <div className="text-sm font-medium text-blue-300">{latestDecision.resumeCandidate}</div>
                    </div>
                  )}

                  {latestDecision.outcome === 'critical' && latestDecision.pausedDataset && (() => {
                    const alreadyPaused = datasets.some(
                      (d) => d.name === latestDecision.pausedDataset && d.status === 'paused'
                    )
                    if (alreadyPaused) {
                      return (
                        <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-xl">
                          <div className="text-xs text-yellow-400 font-medium">Intervention already executed</div>
                          <p className="text-xs text-gray-500 mt-1">
                            {latestDecision.pausedDataset} has been paused on-chain.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <button
                        onClick={executeIntervention}
                        disabled={loading}
                        className="w-full btn-danger"
                      >
                        {loading ? 'Pausing...' : `Pause ${latestDecision.pausedDataset}`}
                      </button>
                    )
                  })()}

                  {(latestDecision.outcome === 'resume_safe' || latestDecision.outcome === 'resume_available') && latestDecision.resumeCandidate && (() => {
                    const isPaused = datasets.some(
                      (d) => d.name === latestDecision.resumeCandidate && d.status === 'paused'
                    )
                    if (!isPaused) {
                      return (
                        <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-xl">
                          <div className="text-xs text-green-400 font-medium">Already active</div>
                          <p className="text-xs text-gray-500 mt-1">
                            {latestDecision.resumeCandidate} is already active.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <button
                        onClick={resumeDataset}
                        disabled={loading}
                        className="w-full btn-success"
                      >
                        {loading ? 'Resuming...' : `Resume ${latestDecision.resumeCandidate}`}
                      </button>
                    )
                  })()}

                  {latestDecision.outcome === 'resume_insufficient' && latestDecision.resumeCandidate && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-xl">
                      <div className="text-xs text-yellow-400 font-medium">Resume not safe yet</div>
                      <p className="text-xs text-gray-500 mt-1">
                        Runway has recovered but resuming {latestDecision.resumeCandidate} would still put the account below threshold.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-gray-500 mb-1">Reason</div>
                    <div className="text-sm text-gray-300 leading-relaxed">{latestDecision.reason}</div>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
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

          {/* Dataset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {datasets.map((ds) => (
              <div key={ds.datasetId} className="card-glass group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">{ds.name}</h3>
                  <span className={`badge ${
                    ds.status === 'active' ? 'badge-success' : 'badge-danger'
                  }`}>
                    {ds.status.toUpperCase()}
                  </span>
                </div>
                 
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Declared Value <RealBadge /></span>
                    <span className="text-lg font-mono text-white">{ds.declaredValue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Size</span>
                    <span className="text-lg font-mono text-white">{ds.sizeBytes} bytes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Cost / Epoch <SimulatedBadge /></span>
                    <span className="text-lg font-mono text-white">{formatWei(ds.costPerEpoch)} USDFC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Dataset ID <RealBadge /></span>
                    <ExplorerLink href={`https://calibration.filfox.info/en/address/${account ? '0x6c79C23ef70df857a0544111a29A21b655709090' : ''}`} className="text-lg font-mono">
                      #{ds.datasetId}
                    </ExplorerLink>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">PieceCID</span>
                    <ExplorerLink href={`https://cid.ipfs.io/#${ds.pieceCid}`} className="text-sm font-mono text-gray-300 truncate max-w-[200px]">
                      {ds.pieceCid.slice(0, 20)}...
                    </ExplorerLink>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Provider</span>
                    <a href={ds.provider} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-gray-300 truncate max-w-[200px] hover:text-white transition">
                      {ds.provider.replace('https://', '')}
                    </a>
                  </div>

                  {ds.status === 'paused' && (
                    <div className="pt-4 border-t border-gray-800 mt-4">
                      <button
                        onClick={() => verifyPause(ds.datasetId)}
                        disabled={verifyingId === ds.datasetId}
                        className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-white font-medium rounded-xl transition border border-gray-700"
                      >
                        {verifyingId === ds.datasetId ? 'Verifying...' : 'Verify Pause'}
                      </button>
                      {verifyResult[ds.datasetId] && (
                        <div className={`mt-3 text-sm p-3 rounded-xl ${
                          verifyResult[ds.datasetId].accessible
                            ? 'bg-yellow-900/30 text-yellow-200 border border-yellow-800/50'
                            : 'bg-green-900/30 text-green-200 border border-green-800/50'
                        }`}>
                          {verifyResult[ds.datasetId].accessible
                            ? 'Provider still serves cached piece, but payment rail is terminated — no new charges.'
                            : verifyResult[ds.datasetId].message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Claude Explanation + Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card-glass">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Claude Explanation</h3>
              </div>
              {latestDecision?.explanation ? (
                <p className="text-gray-200 leading-relaxed text-lg">{latestDecision.explanation}</p>
              ) : (
                <p className="text-gray-500">Run a check to generate an explanation.</p>
              )}
            </div>

            <div className="card-glass">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Decision Log</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {decisions.length === 0 && (
                  <p className="text-gray-500 text-sm">No decisions recorded yet.</p>
                )}
                {[...decisions].reverse().map((d, idx) => (
                  <div key={d.timestamp + idx} className="border-b border-gray-800 pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${d.outcome === 'critical' ? 'text-red-400' : 'text-green-400'}`}>
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

            <div className="card-glass">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Intervention Log</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {interventions.length === 0 && (
                  <p className="text-gray-500 text-sm">No interventions executed yet.</p>
                )}
                {[...interventions].reverse().map((item, idx) => (
                  <div key={item.timestamp + idx} className="border-b border-gray-800 pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${
                        item.status === 'completed' ? 'text-green-400' : item.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
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
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        <ExplorerLink href={`https://calibration.filfox.info/en/tx/${item.txHash}`} className="font-mono">
                          tx: {item.txHash.slice(0, 10)}...{item.txHash.slice(-8)}
                        </ExplorerLink>
                      </div>
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
      </section>
    </div>
  )
}
