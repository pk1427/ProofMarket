import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

export default function Landing() {
  return (
    <div className="min-h-screen canvas">
      <Navbar />
      <main className="pt-16">
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Storage budget management
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
              Keep the data that <span className="gradient-text">matters most</span>.
            </h1>
            <p className="mt-5 text-lg leading-7 text-ink-2">
              ProofMarket monitors a storage budget, ranks datasets by value, and pauses the
              lowest-priority one when runway falls below threshold.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/demo" className="btn-primary">
                View live account <span aria-hidden="true">→</span>
              </Link>
              <Link to="/verification" className="btn-secondary">
                View intervention history
              </Link>
            </div>
            <p className="mt-6 text-xs text-ink-3">
              Built for the FilecoinTLDR Builder Challenge, Cycle 4 · Filecoin Calibration testnet
            </p>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>ProofMarket</span>
        <div className="flex gap-5">
          <Link to="/demo" className="hover:text-ink transition-colors">Dashboard</Link>
          <Link to="/verification" className="hover:text-ink transition-colors">Verification</Link>
          <a href="https://github.com/pk1427/ProofMarket" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">Source</a>
        </div>
      </footer>
    </div>
  )
}
