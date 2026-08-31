import { Link } from 'react-router-dom'

export default function Architecture() {
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
            <Link to="/verification" className="hover:text-white transition">Verification</Link>
            <span className="text-white">Architecture</span>
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

      {/* Architecture Section */}
      <section id="architecture" className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Architecture</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              A minimal stack that keeps the decision logic authoritative in code and the LLM as an explainer, never a decision-maker.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Frontend */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">UI</span>
                </div>
                <h3 className="text-xl font-bold">Frontend</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">Vite + React + Tailwind</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">Live dashboard polling every 30s</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">Pause verification UI</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">Animated health indicators</span>
                </div>
              </div>
            </div>

            {/* Backend */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">BE</span>
                </div>
                <h3 className="text-xl font-bold">Backend</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300">Node.js + Express</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300">Synapse SDK (Calibration)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300">Decision loop + JSON logging</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-300">OpenRouter Claude explanation</span>
                </div>
              </div>
            </div>

            {/* Onchain */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">FC</span>
                </div>
                <h3 className="text-xl font-bold">Onchain</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Filecoin Pay (USDFC)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Warm Storage (PDP)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Real pause/termination tx</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Payment rail validation</span>
                </div>
              </div>
            </div>

            {/* AI Layer */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">AI</span>
                </div>
                <h3 className="text-xl font-bold">Reasoning Layer</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300">Claude via OpenRouter</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300">One call per decision cycle</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300">Structured input → prose output</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300">Rules-based fallback</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Lineage */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl font-bold mb-8 text-center">Data Lineage</h3>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              Clear separation between real onchain state and simulated user inputs. 
              Never let simulated data masquerade as blockchain truth.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-green-900/10 border border-green-800/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="text-sm text-green-400 font-semibold">REAL — Onchain</div>
                </div>
                <ul className="space-y-2">
                  {[
                    'USDFC balance via Synapse SDK',
                    'Runway in epochs from Filecoin Pay',
                    'Lockup rate per epoch',
                    'Dataset pause/termination transaction',
                    'Current epoch number',
                    'Payment rail status',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-green-500 mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-yellow-900/10 border border-yellow-800/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="text-sm text-yellow-400 font-semibold">SIMULATED — User Inputs</div>
                </div>
                <ul className="space-y-2">
                  {[
                    'declared_value (dataset priority)',
                    'cost_per_epoch (scaled by size)',
                    'Triage threshold (10k epochs)',
                    'Target demo balance',
                    'LLM explanation (generated)',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-yellow-500 mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
