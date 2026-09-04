import { Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Navbar({ active }: { active?: 'home' | 'demo' | 'verification' }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PM</span>
          </div>
          <span className="text-xl font-bold gradient-text-subtle">
            ProofMarket
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/" className={`nav-link ${active === 'home' ? 'text-white font-medium' : ''}`}>Home</Link>
          <Link to="/demo" className={`nav-link ${active === 'demo' ? 'text-white font-medium' : ''}`}>Live Demo</Link>
          <Link to="/verification" className={`nav-link ${active === 'verification' ? 'text-white font-medium' : ''}`}>Verification</Link>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
          <a
            href="https://github.com/pk1427/ProofMarket"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-block px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
          >
            View Source
          </a>
        </div>
      </div>
    </nav>
  )
}
