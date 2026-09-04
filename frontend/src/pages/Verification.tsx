import { useState, useEffect, useCallback } from 'react'
import type { Dataset, InterventionResult } from '../types'
import { Navbar } from '../components/Navbar'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'
const FILFOX_BASE = 'https://calibration.filfox.info/en'

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-500 transition font-mono text-xs"
    >
      {children}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function OnchainBadge() {
  return (
    <span className="badge badge-healthy ml-1.5">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Onchain
    </span>
  )
}

function shortenHash(hash: string, head = 6, tail = 4) {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export default function Verification() {
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
      const [dsRes, intRes] = await Promise.all([
        fetch(`${API_BASE}/api/datasets`),
        fetch(`${API_BASE}/api/interventions`),
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
  }, [])

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

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-10 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 mb-3">Verification</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Prove the intervention is real.
            </h1>
            <p className="mt-3 max-w-3xl text-ink-2 leading-relaxed">
              After pausing a dataset, click <span className="font-semibold text-ink">Verify Pause</span> to check
              whether the provider still serves the piece. A terminated payment rail means no new charges,
              even if cached copies remain briefly.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 surface-danger rounded-xl text-danger-fg flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Intervention History */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">Intervention History</h2>
              <span className="text-sm text-ink-3">{interventions.length} onchain actions</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="card p-6">
                    <div className="skeleton h-5 w-1/3 mb-3" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : interventions.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 grid place-items-center mb-3">
                  <svg className="w-6 h-6 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-ink-2 font-medium">No interventions yet</p>
                <p className="text-sm text-ink-3 mt-1">Go to the Live Demo to run a triage check.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...interventions].reverse().map((item, idx) => (
                  <div key={item.timestamp + idx} className="card p-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">{item.datasetName}</h3>
                        <span className="font-mono text-xs text-ink-3">#{item.datasetId}</span>
                      </div>
                      <span className={`badge ${item.status === 'completed' ? 'badge-completed' : 'badge-failed'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {item.txHash && (
                        <div>
                          <div className="text-xs text-ink-3 mb-0.5">Transaction</div>
                          <ExplorerLink href={`${FILFOX_BASE}/tx/${item.txHash}`}>{shortenHash(item.txHash)}</ExplorerLink>
                        </div>
                      )}
                      {item.action && (
                        <div>
                          <div className="text-xs text-ink-3 mb-0.5">Action</div>
                          <div className="font-mono text-xs text-ink-2 capitalize">{item.action}</div>
                        </div>
                      )}
                      {item.newDatasetId && (
                        <div>
                          <div className="text-xs text-ink-3 mb-0.5">New Dataset ID</div>
                          <div className="font-mono text-xs text-ink-2">#{item.newDatasetId}</div>
                        </div>
                      )}
                      {item.endEpoch && (
                        <div>
                          <div className="text-xs text-ink-3 mb-0.5">End Epoch</div>
                          <div className="font-mono text-xs text-ink-2">{item.endEpoch}</div>
                        </div>
                      )}
                    </div>
                    {item.error && (
                      <div className="mt-3 p-3 surface-danger rounded-lg text-sm text-danger-fg">{item.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dataset State */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">Dataset State</h2>
              <span className="text-sm text-ink-3">{datasets.length} tracked</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="card p-6">
                    <div className="skeleton h-5 w-1/2 mb-4" />
                    <div className="skeleton h-4 w-full mb-2" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : datasets.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-ink-2 font-medium">No datasets registered</p>
                <p className="text-sm text-ink-3 mt-1">Create datasets in the Live Demo to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {datasets.map((ds) => (
                  <div key={ds.datasetId} className="card p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-base font-semibold text-ink truncate">{ds.name}</h3>
                      <span className={`badge ${ds.status === 'active' ? 'badge-healthy' : 'badge-warning'}`}>
                        {ds.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-3 shrink-0">Dataset ID<OnchainBadge /></span>
                        <ExplorerLink href={`${FILFOX_BASE}/address/0x6c79C23ef70df857a0544111a29A21b655709090`}>#{ds.datasetId}</ExplorerLink>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-3 shrink-0">PieceCID</span>
                        <ExplorerLink href={`https://cid.ipfs.io/#${ds.pieceCid}`}>{shortenHash(ds.pieceCid, 8, 4)}</ExplorerLink>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-3 shrink-0">Provider</span>
                        <a href={ds.provider} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-ink-2 hover:text-ink transition truncate max-w-[180px]">
                          {ds.provider.replace('https://', '')}
                        </a>
                      </div>
                    </div>
                    {ds.status === 'paused' && (
                      <div className="pt-4 border-t border-line">
                        <button
                          onClick={() => verifyPause(ds.datasetId)}
                          disabled={verifyingId === ds.datasetId}
                          className="btn-secondary w-full"
                        >
                          {verifyingId === ds.datasetId ? (
                            <><span className="spinner" /> Verifying…</>
                          ) : (
                            <>Verify Pause</>
                          )}
                        </button>
                        {verifyResult[ds.datasetId] && (
                          <div className={`mt-3 text-sm p-3 rounded-lg ${
                            verifyResult[ds.datasetId].accessible ? 'surface-warning text-warning-fg' : 'surface-healthy text-success-fg'
                          }`}>
                            {verifyResult[ds.datasetId].accessible
                              ? 'Provider still serves cached piece, but payment rail is terminated — no new charges.'
                              : verifyResult[ds.datasetId].message}
                          </div>
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
