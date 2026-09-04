import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

const features = [
  ['Read the account', 'Checks the Filecoin Pay balance, current spend, and remaining runway.'],
  ['Set priorities', 'Uses the value assigned to each dataset to identify what should be kept.'],
  ['Take action', 'Pauses the lowest-priority dataset when the budget requires it.'],
]

const steps = [
  ['01', 'Check', 'Read the account state from the chain.'],
  ['02', 'Compare', 'Rank datasets by their declared value.'],
  ['03', 'Pause', 'Stop the lowest-priority storage payment.'],
  ['04', 'Record', 'Show the decision and its onchain result.'],
]

export default function Landing() {
  return (
    <div className="min-h-screen canvas">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Storage budget management
              </p>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-ink md:text-5xl lg:text-6xl">
                Keep the data that <span className="gradient-text">matters most</span>.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-2">
                ProofMarket monitors a storage budget, compares dataset priorities, and pauses the
                least important dataset when runway falls below your threshold.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/demo" className="btn-primary">
                  View live account <span aria-hidden="true">→</span>
                </Link>
                <Link to="/verification" className="btn-secondary">
                  View intervention history
                </Link>
              </div>
              <p className="mt-5 text-sm text-ink-3">Built for the FilecoinTLDR Builder Challenge, Cycle 4.</p>
            </div>
            <aside className="card p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <span className="text-sm font-medium text-ink-3">Decision preview</span>
                <span className="status-pill status-healthy">
                  <span className="pulse-dot" /> Account healthy
                </span>
              </div>
              <dl className="space-y-5 py-6 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Runway</dt>
                  <dd className="font-semibold text-ink">Above threshold</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Highest priority</dt>
                  <dd className="font-semibold text-ink font-mono text-xs">customer-model-v3.txt</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Next action</dt>
                  <dd className="font-semibold text-ink">No action needed</dd>
                </div>
              </dl>
              <div className="rounded-lg surface-info px-4 py-3 text-sm text-info-fg">
                The dashboard reads live account and storage data from the connected testnet account.
              </div>
            </aside>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">What it does</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">A simple rule for storage decisions.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map(([title, description], index) => (
              <article key={title} className="card card-hover p-6">
                <div className="mb-5 grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-sm font-bold text-brand-700">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 leading-6 text-ink-2">{description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">A decision you can inspect.</h2>
            <div className="mt-10 grid gap-0 overflow-hidden rounded-xl border border-line">
              {steps.map(([number, title, description], i) => (
                <div
                  key={number}
                  className={`bg-white p-6 ${
                    i < steps.length - 1 ? 'border-b border-line' : ''
                  } md:border-b-0 md:border-r md:last:border-r-0`}
                >
                  <span className="text-sm font-bold text-brand-700">{number}</span>
                  <h3 className="mt-6 font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-2">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>ProofMarket — FilecoinTLDR Cycle 4</span>
        <div className="flex gap-5">
          <Link to="/demo" className="hover:text-ink transition-colors">Dashboard</Link>
          <Link to="/verification" className="hover:text-ink transition-colors">Verification</Link>
          <a href="https://github.com/pk1427/ProofMarket" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">Source</a>
        </div>
      </footer>
    </div>
  )
}
