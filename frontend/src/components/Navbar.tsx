import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

const links: { to: string; label: string; key: 'home' | 'demo' | 'verification' }[] = [
  { to: '/', label: 'Home', key: 'home' },
  { to: '/demo', label: 'Live Demo', key: 'demo' },
  { to: '/verification', label: 'Verification', key: 'verification' },
]

export function Navbar() {
  const location = useLocation()
  const { isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setOpen(false) }, [location.pathname])

  const activeKey = links.find((l) => l.to === location.pathname)?.key

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all ${
        scrolled
          ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
          : 'bg-white/70 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative w-9 h-9 rounded-lg gradient-brand flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold text-ink">ProofMarket</span>
            <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">Storage Triage</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeKey === l.key
                  ? 'text-ink bg-slate-100'
                  : 'text-ink-3 hover:text-ink hover:bg-slate-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/pk1427/ProofMarket"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex btn-ghost p-2"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.3 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <div className="[&>div]:!h-9 [&_button]:!rounded-lg [&_button]:!h-9 [&_button]:!text-sm">
            <ConnectButton
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 rounded-md text-ink-2 hover:bg-slate-100"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-2.5 text-sm font-medium rounded-md ${
                  activeKey === l.key ? 'text-ink bg-slate-100' : 'text-ink-2 hover:bg-slate-50'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isConnected && (
              <div className="mt-2 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-ink-3">
                <span className="pulse-dot text-emerald-600" /> Wallet connected
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
