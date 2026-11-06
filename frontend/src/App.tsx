import { useEffect, useState } from 'react';
import { 
  Printer, 
  Database, 
  Server, 
  HardDrive, 
  RefreshCw, 
  QrCode, 
  Key,
  Building2
} from 'lucide-react';
import { CustomerPrintPortal } from './components/CustomerPrintPortal';
import { ShopOwnerDashboard } from './components/ShopOwnerDashboard';
import { PairingHelperModal } from './components/PairingHelperModal';

interface HealthData {
  status: string;
  app: {
    name: string;
    env: string;
    version: string;
    laravel: string;
    php: string;
  };
  services: {
    database: {
      status: string;
      driver: string;
      version: string;
      error: string | null;
    };
    storage: {
      status: string;
      path: string;
    };
    queue: {
      driver: string;
    };
  };
  timestamp: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'dashboard' | 'system'>('customer');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to reach PrintEase API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm shadow-[#4F46E5]/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0F172A]">PrintEase</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                  SaaS Core
                </span>
              </div>
              <p className="text-xs text-[#64748B]">Autonomous Multi-Shop Self-Service Printing</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('customer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'customer'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              Customer Self-Service
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Shop Owner Dashboard
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              System Diagnostics
            </button>

            <button
              onClick={() => setShowPairingModal(true)}
              className="ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              Pairing Code
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'customer' ? (
          <CustomerPrintPortal 
            defaultQrToken="pe_demo_connaught_branch_token_99" 
            onOpenPairingInfo={() => setShowPairingModal(true)}
          />
        ) : activeTab === 'dashboard' ? (
          <ShopOwnerDashboard />
        ) : (
          /* System Architecture & Diagnostics View */
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Platform Core Services</h2>
                  <p className="text-xs text-slate-500">Live health monitoring across backend, database, and storage</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    Updated: {lastChecked.toLocaleTimeString()}
                  </span>
                  <button
                    onClick={fetchHealth}
                    disabled={loading}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loading && !health ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
                  <p className="text-xs">Probing backend APIs...</p>
                </div>
              ) : error ? (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {error}
                </div>
              ) : health ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {/* Database Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>MySQL 8.4 Database</span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {health.services.database.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>Driver: <span className="font-mono">{health.services.database.driver}</span></p>
                      <p>Version: <span className="font-mono">{health.services.database.version}</span></p>
                    </div>
                  </div>

                  {/* Backend Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
                        <Server className="w-4 h-4 text-indigo-600" />
                        <span>Laravel 11 Backend</span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {health.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>Laravel: <span className="font-mono">{health.app.laravel}</span></p>
                      <p>PHP: <span className="font-mono">{health.app.php}</span></p>
                    </div>
                  </div>

                  {/* Storage Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
                        <HardDrive className="w-4 h-4 text-indigo-600" />
                        <span>Private Storage</span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {health.services.storage.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>Target: <span className="font-mono truncate block">storage/app/private</span></p>
                      <p>Encryption: <span className="font-semibold text-emerald-600">Restricted</span></p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Test Credentials Reference Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-sm text-slate-900 mb-4">Seeded Test Credentials & Tokens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-indigo-600">Demo Shop Owner Account</div>
                  <p><span className="text-slate-500">Email:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">owner@metroprint.com</code></p>
                  <p><span className="text-slate-500">Password:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">Secret@12345</code></p>
                  <p><span className="text-slate-500">Role:</span> <span className="font-semibold text-slate-700">Shop Owner</span></p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="font-bold text-indigo-600">Branch & Agent Keys</div>
                  <p><span className="text-slate-500">Branch QR:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">pe_demo_connaught_branch_token_99</code></p>
                  <p><span className="text-slate-500">Pairing Code:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold text-indigo-700">PRNT-8821-X9</code></p>
                  <p><span className="text-slate-500">Branch:</span> <span className="font-semibold text-slate-700">Connaught Place Main Branch</span></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Pairing Helper Modal */}
      <PairingHelperModal 
        isOpen={showPairingModal} 
        onClose={() => setShowPairingModal(false)} 
      />
    </div>
  );
}
export default App;
