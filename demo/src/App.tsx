import { useState } from 'react';
import { Dashboard } from './components/dashboard/Dashboard';
import { PricingPage } from './components/pricing/PricingPage';
import { useAuth } from './hooks/useAuth';

type Tab = 'dashboard' | 'pricing';

/**
 * Top-level application shell with responsive navigation header and tab-based page routing.
 */
export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold shadow-md shadow-indigo-500/20">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="m13 13 6 6" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white">Agent Hover demomdeomoeme</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Demo
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Pricing
            </button>
          </nav>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400">{user.role ?? 'Member'}</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-indigo-400 border border-slate-700">
                  {user.name.charAt(0)}
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Guest</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' ? <Dashboard /> : <PricingPage />}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>
          Agent Hover Demo App • Test component discovery, AST inspection, and prop extraction.
        </p>
      </footer>
    </div>
  );
}

export default App;
