import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import type { Dataset, InterventionResult } from '../types'
import { Navbar } from '../components/Navbar'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'
const FILFOX_BASE = 'https://calibration.filfox.info/en'

function shortenHash(hash: string, head = 6, tail = 4) {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

function StatusPill({ status }: { status: 'active' | 'paused' | 'completed' | 'pending' | 'failed' }) {
  const cls =
    status === 'active' || status === 'completed' ? 'pill-completed' :
    status === 'pending' ? 'pill-pending' :
    status === 'failed' ? 'pill-failed' :
    'pill-warning'
  return <span className={cls}>{status}</span>
}

export default function Verification() {
  const { address, isConnected } = useAccount()
  const scopeAddress = isConnected && address ? address : undefined
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [interventions, setInterventions] = useState<InterventionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, { accessible: boolean; message: string }>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = scopeAddress ? `?address=${scopeAddress}` : ''
      const [dsRes, intRes] = await Promise.all([
        fetch(`${API_BASE}/api/datasets${qs}`),
        fetch(`${API_BASE}/api/interventions${qs}`),
      ])
      if (!dsRes.ok) throw new Error('Failed to fetch datasets')
      if (!intRes.ok) throw new Error('Failed to fetch interventions')
      setDatasets(await dsRes.json())
      setInterventions(await intRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [scopeAddress])

  useEffect(() => { fetchData() }, [fetchData])

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

  return (
    <div className="min-h-screen canvas">
      <Navbar />
      <main className="pt-14">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">Verification</p>
              {scopeAddress ? (
                <span className="pill-success">
                  <span className="pulse-dot" />
                  wallet · {scopeAddress.slice(0, 6)}…{scopeAddress.slice(-4)}
                </span>
              ) : (
                <span className="pill-neutral">demo account · 0x6c79…9090</span>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Proof of intervention.</h1>
            <p className="mt-3 text-ink-2 max-w-2xl leading-relaxed">
              After pausing a dataset, click <span className="font-medium text-ink">Verify Pause</span> to check
              whether the provider still serves the piece. A terminated payment rail means no new charges,
              even if cached copies remain briefly.
            </p>
          </div>

          {error && (
            <div className="mb-6 pill-danger px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          {/* Intervention History */}
          <section className="mb-16">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">Intervention history</h2>
              <span className="text-xs text-ink-3 font-mono">{interventions.length} onchain actions</span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="py-4 border-b border-line">
                    <div className="skeleton h-4 w-1/3 mb-2" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : interventions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-ink-2 font-medium">No interventions yet</p>
                <p className="text-sm text-ink-3 mt-1">Go to the Live Demo to run a triage check.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {[...interventions].reverse().map((item, idx) => (
                  <div key={item.timestamp + idx} className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-ink truncate">{item.datasetName}</span>
                        <span className="font-mono text-xs text-ink-3">#{item.datasetId}</span>
                        {item.txHash && (
                          <a
                            href={`${FILFOX_BASE}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-ink-3 hover:text-ink"
                          >
                            {shortenHash(item.txHash)}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-3">{timeAgo(item.timestamp)}</span>
                        <StatusPill status={item.status} />
                      </div>
                    </div>
                    {(item.action || item.newDatasetId || item.endEpoch) && (
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
                        {item.action && <span><span className="text-ink-4">action</span> <span className="font-mono text-ink-2">{item.action}</span></span>}
                        {item.newDatasetId && <span><span className="text-ink-4">new id</span> <span className="font-mono text-ink-2">#{item.newDatasetId}</span></span>}
                        {item.endEpoch && <span><span className="text-ink-4">end epoch</span> <span className="font-mono text-ink-2">{item.endEpoch}</span></span>}
                      </div>
                    )}
                    {item.error && (
                      <div className="mt-2 text-xs text-red-700">{item.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dataset State */}
          <section>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">Datasets</h2>
              <span className="text-xs text-ink-3 font-mono">{datasets.length} tracked</span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="py-4 border-b border-line">
                    <div className="skeleton h-4 w-1/2 mb-2" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : datasets.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-ink-2 font-medium">No datasets registered</p>
                <p className="text-sm text-ink-3 mt-1">Create datasets in the Live Demo to see them here.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {datasets.map((ds) => (
                  <div key={ds.datasetId} className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-ink truncate">{ds.name}</span>
                        <a
                          href={`${FILFOX_BASE}/address/0x6c79C23ef70df857a0544111a29A21b655709090`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-ink-3 hover:text-ink"
                        >
                          #{ds.datasetId}
                        </a>
                        <span className="font-mono text-xs text-ink-3">{shortenHash(ds.pieceCid, 8, 4)}</span>
                      </div>
                      <StatusPill status={ds.status as 'active' | 'paused'} />
                    </div>
                    <div className="mt-1 text-xs text-ink-3 truncate">
                      Provider: <span className="font-mono text-ink-2">{ds.provider.replace('https://', '')}</span>
                    </div>
                    {ds.status === 'paused' && (
                      <div className="mt-3">
                        <button
                          onClick={() => verifyPause(ds.datasetId)}
                          disabled={verifyingId === ds.datasetId}
                          className="btn-secondary !py-1 !px-3 !text-xs"
                        >
                          {verifyingId === ds.datasetId ? <><span className="spinner" /> Verifying…</> : 'Verify pause'}
                        </button>
                        {verifyResult[ds.datasetId] && (
                          <p className={`mt-2 text-xs ${
                            verifyResult[ds.datasetId].accessible ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {verifyResult[ds.datasetId].accessible
                              ? 'Provider still serves cached piece, but payment rail is terminated — no new charges.'
                              : verifyResult[ds.datasetId].message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
