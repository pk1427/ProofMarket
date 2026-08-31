import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Dataset, InterventionResult } from '../types'

const API_BASE = 'http://localhost:3001'

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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PM</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              ProofMarket
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <Link to="/demo" className="hover:text-white transition">Live Demo</Link>
            <span className="text-white">Verification</span>
            <Link to="/architecture" className="hover:text-white transition">Architecture</Link>
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

      {/* Verification Section */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Verification</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Prove the intervention is real. After pausing a dataset, click Verify Pause to check 
              whether the provider still serves the piece. A terminated payment rail means no new charges, 
              even if cached copies remain briefly.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {/* Intervention History */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6">Intervention History</h3>
            {interventions.length === 0 ? (
              <div className="p-8 bg-gray-900 border border-gray-800 rounded-2xl text-center text-gray-500">
                No interventions executed yet. Go to the Live Demo to run a triage check.
              </div>
            ) : (
              <div className="space-y-4">
                {[...interventions].reverse().map((item, idx) => (
                  <div key={item.timestamp + idx} className="p-6 bg-gray-900 border border-gray-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Dataset</div>
                        <div className="text-lg font-semibold text-white">{item.datasetName} #{item.datasetId}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        item.status === 'completed' ? 'bg-green-900/40 text-green-300 border border-green-800/50' : 'bg-red-900/40 text-red-300 border border-red-800/50'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {item.txHash && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Transaction Hash</div>
                          <div className="font-mono text-gray-300 break-all">{item.txHash}</div>
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
            <h3 className="text-2xl font-bold mb-6">Dataset State</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {datasets.map((ds) => (
                <div key={ds.datasetId} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">{ds.name}</h4>
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      ds.status === 'active' ? 'bg-green-900/40 text-green-300 border border-green-800/50' : 'bg-red-900/40 text-red-300 border border-red-800/50'
                    }`}>
                      {ds.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dataset ID</span>
                      <span className="text-gray-200 font-mono">#{ds.datasetId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">PieceCID</span>
                      <span className="text-gray-200 font-mono text-xs truncate max-w-[200px]">{ds.pieceCid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider</span>
                      <span className="text-gray-200 font-mono text-xs truncate max-w-[200px]">{ds.provider}</span>
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
