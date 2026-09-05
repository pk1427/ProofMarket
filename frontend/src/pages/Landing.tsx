import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

export default function Landing() {
  return (
    <div className="min-h-screen canvas">
      <Navbar />
      <main className="pt-14">
        <section className="min-h-[calc(100vh-3.5rem)] flex items-center">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <p className="text-xs font-medium text-ink-3 tracking-wide uppercase mb-6">
              Storage budget management
            </p>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-ink leading-[1.05]">
              Keep the data that<br />
              <span className="gradient-accent">matters most.</span>
            </h1>
            <p className="mt-7 text-lg text-ink-2 leading-relaxed">
              ProofMarket monitors a storage budget, ranks datasets by value,
              and pauses the lowest-priority one when runway falls below threshold.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Link to="/demo" className="btn-primary px-5 py-2.5">
                View live account <span aria-hidden="true">→</span>
              </Link>
              <Link to="/verification" className="btn-secondary px-5 py-2.5">
                View history
              </Link>
            </div>
            <p className="mt-12 text-xs text-ink-4">
              FilecoinTLDR Builder Challenge · Cycle 4 · Calibration testnet
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
