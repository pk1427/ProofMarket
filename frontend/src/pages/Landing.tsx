import { Link } from 'react-router-dom'

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
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-sm text-white">PM</span>ProofMarket</Link>
      <nav className="hidden items-center gap-7 md:flex"><a className="nav-link" href="#how-it-works">How it works</a><Link className="nav-link" to="/verification">History</Link></nav><Link to="/demo" className="btn-primary">Open dashboard</Link>
    </div></header>
    <main>
      <section className="border-b border-slate-200 bg-white"><div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-28">
        <div><p className="mb-5 text-sm font-semibold uppercase tracking-wider text-blue-700">Storage budget management</p><h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Keep the data that matters most.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">ProofMarket monitors a storage budget, compares dataset priorities, and pauses the least important dataset when runway falls below your threshold.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/demo" className="btn-primary">View live account <span aria-hidden="true">→</span></Link><Link to="/verification" className="btn-secondary">View intervention history</Link></div><p className="mt-5 text-sm text-slate-500">Built for the FilecoinTLDR Builder Challenge, Cycle 4.</p></div>
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><span className="text-sm font-medium text-slate-500">Decision preview</span><span className="badge-success">Account healthy</span></div><dl className="space-y-5 py-6 text-sm"><div className="flex justify-between gap-6"><dt className="text-slate-500">Runway</dt><dd className="font-semibold">Above threshold</dd></div><div className="flex justify-between gap-6"><dt className="text-slate-500">Highest priority</dt><dd className="font-semibold">customer-model-v3.txt</dd></div><div className="flex justify-between gap-6"><dt className="text-slate-500">Next action</dt><dd className="font-semibold">No action needed</dd></div></dl><div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">The dashboard reads live account and storage data from the connected testnet account.</div></aside>
      </div></section>
      <section className="mx-auto max-w-6xl px-6 py-20"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">What it does</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">A simple rule for storage decisions.</h2></div><div className="mt-10 grid gap-5 md:grid-cols-3">{features.map(([title, description], index) => <article key={title} className="card-glass"><div className="mb-5 grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">{index + 1}</div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 leading-6 text-slate-600">{description}</p></article>)}</div></section>
      <section id="how-it-works" className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-6xl px-6 py-20"><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">How it works</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">A decision you can inspect.</h2><div className="mt-10 grid gap-0 border border-slate-200 md:grid-cols-4">{steps.map(([number, title, description]) => <div key={number} className="border-b border-slate-200 p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><span className="text-sm font-semibold text-blue-700">{number}</span><h3 className="mt-6 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>)}</div></div></section>
    </main>
    <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>ProofMarket</span><div className="flex gap-5"><Link to="/demo">Dashboard</Link><Link to="/verification">Verification</Link><a href="https://github.com/pk1427/ProofMarket" target="_blank" rel="noreferrer">Source</a></div></footer>
  </div>
}
