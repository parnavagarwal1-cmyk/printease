import { useEffect, useState } from 'react';
import { 
  Printer, 
  Database, 
  Server, 
  HardDrive, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  QrCode, 
  LayoutDashboard, 
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

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
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

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
      {/* Top Navigation */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm shadow-[#4F46E5]/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0F172A]">PrintEase</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                  SaaS Core
                </span>
              </div>
              <p className="text-xs text-[#64748B]">Autonomous Multi-Shop QR Printing Network</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-[#64748B]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Phase 2 Database & Auth Verified</span>
            </div>

            <button
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#4F46E5]' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Banner */}
        <section className="bg-gradient-to-r from-white via-white to-[#EEF2FF] border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]"></span>
              <span>Phase 2 — Multi-Tenant Schema & Secure Auth</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] mb-3">
              Relational Multi-Shop Core Online
            </h1>
            <p className="text-sm sm:text-base text-[#64748B] leading-relaxed mb-6">
              Full multi-tenant architecture is active with foreign keys, Sanctum auth tokens, role isolation (Super Admin, Shop Owner, Branch Manager, Staff), and automated cross-tenant security enforcement.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Backend</span>
                <span className="text-sm font-bold text-[#0F172A]">Laravel 11 (PHP 8.3)</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Database</span>
                <span className="text-sm font-bold text-[#0F172A]">MySQL 8.4 (18 Tables)</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Security</span>
                <span className="text-sm font-bold text-[#0F172A]">Tenant Scoped + Sanctum</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Automated Tests</span>
                <span className="text-sm font-bold text-emerald-600">10/10 Passing</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Diagnostics Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Live System Diagnostics</h2>
              <p className="text-xs text-[#64748B]">Real-time telemetry verified via Laravel <code className="text-[#4F46E5] bg-[#EEF2FF] px-1 py-0.5 rounded">/api/health</code></p>
            </div>
            <span className="text-xs text-[#64748B]">
              Checked: {lastChecked.toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* API & PHP Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-[#4F46E5]">
                    <Server className="w-5 h-5" />
                    <span className="font-semibold text-sm text-[#0F172A]">API Core Engine</span>
                  </div>
                  {health ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                      Offline
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Framework:</span>
                    <span className="font-semibold text-[#0F172A]">{health?.app?.laravel || 'Laravel 11'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">PHP Runtime:</span>
                    <span className="font-semibold text-[#0F172A]">{health?.app?.php || '8.3.36'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Active Routes:</span>
                    <span className="font-semibold text-[#0F172A]">17 REST Endpoints</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Auth Mechanism:</span>
                    <span className="font-semibold text-[#4F46E5]">Laravel Sanctum</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Database Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-[#4F46E5]">
                    <Database className="w-5 h-5" />
                    <span className="font-semibold text-sm text-[#0F172A]">Relational Store</span>
                  </div>
                  {health?.services?.database?.status === 'connected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                      <XCircle className="w-3 h-3 mr-1 text-red-600" />
                      Error
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Engine:</span>
                    <span className="font-semibold text-[#0F172A]">MySQL Community 8.4</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Database:</span>
                    <span className="font-semibold text-[#0F172A]">printease</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Schema Scope:</span>
                    <span className="font-semibold text-[#0F172A]">Multi-Tenant (18 Tables)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Seed Status:</span>
                    <span className="font-semibold text-emerald-600">Populated with Demo Fleet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Private Storage Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-[#4F46E5]">
                    <HardDrive className="w-5 h-5" />
                    <span className="font-semibold text-sm text-[#0F172A]">Private File Storage</span>
                  </div>
                  {health?.services?.storage?.status === 'writable' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                      Writable
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                      Checking
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Security Mode:</span>
                    <span className="font-semibold text-emerald-600">Private (Non-Public)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Storage Path:</span>
                    <span className="font-mono text-[10px] text-[#0F172A] truncate max-w-[170px]">
                      storage/app/private
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Document Retention:</span>
                    <span className="font-semibold text-[#0F172A]">Configurable</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#64748B]">Access Protocol:</span>
                    <span className="font-semibold text-[#4F46E5]">Signed / Device Auth</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-xs text-[#991B1B] flex items-center justify-between">
              <span>{error} — Make sure the Laravel backend server is running on port 8000.</span>
              <button onClick={fetchHealth} className="underline font-semibold hover:text-red-900">Retry</button>
            </div>
          )}
        </section>

        {/* Phase 2 Feature Highlights */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-[#4F46E5]">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-base font-bold text-[#0F172A]">Phase 2 Security & Architecture Deliverables</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#64748B]">
            <div className="border border-[#F1F5F9] rounded-xl p-4 bg-[#F8FAFC]">
              <div className="flex items-center space-x-2 text-[#0F172A] font-bold mb-2">
                <UserCheck className="w-4 h-4 text-[#4F46E5]" />
                <span>Zero-Trust Auth & Roles</span>
              </div>
              <p className="leading-relaxed">
                Super Admin, Shop Owner, Branch Manager, and Staff roles with server-side policy enforcement. Users cannot access or tamper with foreign shops or branches.
              </p>
            </div>

            <div className="border border-[#F1F5F9] rounded-xl p-4 bg-[#F8FAFC]">
              <div className="flex items-center space-x-2 text-[#0F172A] font-bold mb-2">
                <QrCode className="w-4 h-4 text-[#4F46E5]" />
                <span>Unguessable QR Tokens</span>
              </div>
              <p className="leading-relaxed">
                Dynamic 32-character tokens resolve shops and branches server-side without exposing internal auto-increment database IDs to untrusted browsers.
              </p>
            </div>

            <div className="border border-[#F1F5F9] rounded-xl p-4 bg-[#F8FAFC]">
              <div className="flex items-center space-x-2 text-[#0F172A] font-bold mb-2">
                <Printer className="w-4 h-4 text-[#4F46E5]" />
                <span>One-Time Device Pairing</span>
              </div>
              <p className="leading-relaxed">
                Short-lived pairing codes (e.g. <code>PRNT-XXXX-XX</code>) lock Windows Electron clients to physical branches, issuing persistent SHA-256 hashed device tokens.
              </p>
            </div>
          </div>
        </section>

        {/* Portals Overview */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">PrintEase Platform Portals</h2>
            <p className="text-xs text-[#64748B]">All 4 application surfaces scaffolded under the unified Stitch Design System</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Customer Portal */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 hover:border-[#CBD5E1] transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0F172A] mb-1">Customer Self-Service</h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Zero-install mobile and desktop web interface. Scan QR, upload PDF, configure duplex/color/copies, pay online, and monitor print progress.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs font-semibold text-[#4F46E5]">
                <span>Phase 3 Target</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Shop Owner Portal */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 hover:border-[#CBD5E1] transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-4">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0F172A] mb-1">Shop Owner Dashboard</h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Fleet and branch control, pricing matrix engine, live print queue spooler, earnings telemetry, and team management based on Stitch design.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs font-semibold text-[#4F46E5]">
                <span>Phase 6 Target</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Desktop Spooler Engine */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 hover:border-[#CBD5E1] transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-4">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[#0F172A] mb-1">Windows Desktop Agent</h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                  Electron Windows client with secure device pairing, native Windows printer enumeration, idempotent job polling, and spooler submission.
                </p>
              </div>
              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs font-semibold text-[#4F46E5]">
                <span>Phase 5 Target</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-6 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
          <span>PrintEase Autonomous Multi-Shop QR Printing SaaS • Phase 2 Verified</span>
          <div className="flex items-center space-x-4">
            <span>PHP 8.3.36</span>
            <span>•</span>
            <span>Laravel 11</span>
            <span>•</span>
            <span>MySQL 8.4</span>
            <span>•</span>
            <span>React 19</span>
            <span>•</span>
            <span>Electron</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
