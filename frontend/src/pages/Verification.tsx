import { useState, useEffect, useCallback } from 'react'
import type { Dataset, InterventionResult } from '../types'
import { Navbar } from '../components/Navbar'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

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

function RealBadge() {
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold rounded border border-emerald-700/60 uppercase tracking-wider">
      Onchain
    </span>
  )
}

export default function Verification() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [interventions, setInterventions] = useState<InterventionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, { accessible: boolean; message: string }>>({})

  const fetchData = useCallback(async () => {
    try {
      const [dsRes, intRes] = await Promise.all([
        fetch(`${API_BASE}/api/datasets`),
        fetch(`${API_BASE}/api/interventions`),
      ])
      if (!dsRes.ok) throw new Error('Failed to fetch datasets')
      if (!intRes.ok) throw new Error('Failed to fetch interventions')
      const dsData = await dsRes.json()
      const intData = await intRes.json()
      setDatasets(dsData)
      setInterventions(intData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <Navbar active="verification" />

      {/* Verification Section */}
      <section className="pt-32 pb-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Verification</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Prove the intervention is real. After pausing a dataset, click Verify Pause to check 
              whether the provider still serves the piece. A terminated payment rail means no new charges, 
              even if cached copies remain briefly.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700/50 rounded-xl text-red-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Intervention History */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6 gradient-text">Intervention History</h3>
            {interventions.length === 0 ? (
              <div className="p-8 card-glass text-center text-gray-500">
                No interventions executed yet. Go to the Live Demo to run a triage check.
              </div>
            ) : (
              <div className="space-y-4">
                {[...interventions].reverse().map((item, idx) => (
                  <div key={item.timestamp + idx} className="card-glass">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Dataset</div>
                        <div className="text-lg font-semibold text-white">{item.datasetName} #{item.datasetId}</div>
                      </div>
                      <span className={`badge ${
                        item.status === 'completed' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                       {item.txHash && (
                         <div>
                           <div className="text-xs text-gray-500 mb-1">Transaction Hash</div>
                           <ExplorerLink href={`https://calibration.filfox.info/en/tx/${item.txHash}`} className="font-mono break-all">
                             {item.txHash}
                           </ExplorerLink>
                         </div>
                       )}
                       {item.action && (
                         <div>
                           <div className="text-xs text-gray-500 mb-1">Action</div>
                           <div className="font-mono text-gray-300 capitalize">{item.action}</div>
                         </div>
                       )}
                       {item.newDatasetId && (
                         <div>
                           <div className="text-xs text-gray-500 mb-1">New Dataset ID</div>
                           <div className="font-mono text-gray-300">#{item.newDatasetId}</div>
                         </div>
                       )}
                       {item.endEpoch && (
                         <div>
                           <div className="text-xs text-gray-500 mb-1">End Epoch</div>
                           <div className="font-mono text-gray-300">{item.endEpoch}</div>
                         </div>
                       )}
                     </div>

                     {item.error && (
                       <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-xl text-sm text-red-300">
                         {item.error}
                       </div>
                     )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dataset Verification */}
          <div>
            <h3 className="text-2xl font-bold mb-6 gradient-text">Dataset State</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {datasets.map((ds) => (
                <div key={ds.datasetId} className="card-glass">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">{ds.name}</h4>
                    <span className={`badge ${
                      ds.status === 'active' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {ds.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dataset ID <RealBadge /></span>
                    <ExplorerLink href="https://calibration.filfox.info/en/address/0x6c79C23ef70df857a0544111a29A21b655709090" className="text-gray-200 font-mono">
                      #{ds.datasetId}
                    </ExplorerLink>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">PieceCID</span>
                      <ExplorerLink href={`https://cid.ipfs.io/#${ds.pieceCid}`} className="text-gray-200 font-mono text-xs truncate max-w-[200px]">
                        {ds.pieceCid.slice(0, 20)}...
                      </ExplorerLink>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider</span>
                      <a href={ds.provider} target="_blank" rel="noopener noreferrer" className="text-gray-200 font-mono text-xs truncate max-w-[200px] hover:text-white transition">
                        {ds.provider.replace('https://', '')}
                      </a>
                    </div>
                  </div>

                  {ds.status === 'paused' && (
                    <div className="pt-4 border-t border-gray-800">
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
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
