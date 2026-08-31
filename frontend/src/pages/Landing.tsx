import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-black to-purple-900/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-full text-blue-300 text-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            FilecoinTLDR Builder Challenge — Cycle 4
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              The agent that decides
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              what to keep
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
            Most storage agents ask <em className="text-gray-300">"can I afford this?"</em> ProofMarket asks 
            <em className="text-gray-300"> "which of my datasets is worth protecting?"</em> 
            It reads its own USDFC balance and Filecoin Pay runway, compares competing datasets by priority, 
            pauses the lower-value one — then explains the trade-off in plain language.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/demo"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 transition shadow-lg shadow-blue-900/20"
            >
              See Live Demo
            </Link>
            <Link
              to="/verification"
              className="px-8 py-2 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition"
            >
              Verify Intervention
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="text-3xl font-bold text-white mb-2">Real</div>
              <div className="text-sm text-gray-400">Onchain balance, runway, and pause transactions via Synapse SDK on Calibration testnet</div>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="text-3xl font-bold text-white mb-2">Decides</div>
              <div className="text-sm text-gray-400">Compares datasets by declared value and autonomously triages the lower-priority one</div>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="text-3xl font-bold text-white mb-2">Explains</div>
              <div className="text-sm text-gray-400">Generates a plain-English rationale via LLM, with a rules-based fallback</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            ProofMarket monitors its own storage budget in real time. When runway gets tight, it makes a call — and justifies it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Read',
                desc: 'Pulls USDFC balance and runway from Filecoin Pay via Synapse SDK. No mocks, no simulation.',
                color: 'from-blue-500 to-cyan-500'
              },
              {
                step: '02',
                title: 'Compare',
                desc: 'Weighs competing datasets by declared priority. Higher value wins protection; lower value becomes the triage target.',
                color: 'from-purple-500 to-pink-500'
              },
              {
                step: '03',
                title: 'Act',
                desc: 'Pauses the lower-priority dataset on Warm Storage via a real onchain termination transaction.',
                color: 'from-orange-500 to-red-500'
              },
              {
                step: '04',
                title: 'Explain',
                desc: 'Sends the decision context to Claude via OpenRouter and gets back a one-paragraph rationale.',
                color: 'from-green-500 to-emerald-500'
              }
            ].map((item) => (
              <div key={item.step} className="relative p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition group">
                <div className={`absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-sm font-bold shadow-lg`}>
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mt-4 mb-2 group-hover:text-white transition">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Architecture</h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            A minimal stack that keeps the decision logic authoritative in code and the LLM as an explainer, never a decision-maker.
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Frontend</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-300">Vite + React + Tailwind</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-300">Live dashboard polling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-300">Pause verification UI</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Backend</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-300">Node.js + Express</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-300">Synapse SDK (Calibration)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-300">Decision loop + logging</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Onchain</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Filecoin Pay (USDFC)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Warm Storage (PDP)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300">Real pause/termination</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-800">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Data Lineage</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-green-900/10 border border-green-800/30 rounded-xl">
                  <div className="text-xs text-green-400 font-semibold mb-2">REAL — Onchain</div>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• USDFC balance via Synapse SDK</li>
                    <li>• Runway in epochs from Filecoin Pay</li>
                    <li>• Lockup rate per epoch</li>
                    <li>• Dataset pause/termination tx</li>
                    <li>• Current epoch number</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-900/10 border border-yellow-800/30 rounded-xl">
                  <div className="text-xs text-yellow-400 font-semibold mb-2">SIMULATED — User Inputs</div>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• declared_value (dataset priority)</li>
                    <li>• cost_per_epoch (scaled by size)</li>
                    <li>• Triage threshold (10k epochs)</li>
                    <li>• Target demo balance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">PM</span>
            </div>
            <span className="font-semibold text-white">ProofMarket</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Autonomous Storage Budget Triage — FilecoinTLDR Builder Challenge Cycle 4
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <Link to="/demo" className="hover:text-white transition">Demo</Link>
            <Link to="/verification" className="hover:text-white transition">Verification</Link>
            <a href="https://github.com/pk1427/ProofMarket" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              GitHub
            </a>
            <a href="https://docs.filecoin.cloud" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              Filecoin Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
