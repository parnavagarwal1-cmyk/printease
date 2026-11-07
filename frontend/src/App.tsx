import { useState } from 'react';
import { 
  Printer, 
  Building2, 
  ShieldCheck 
} from 'lucide-react';
import { CustomerPrintPortal } from './components/CustomerPrintPortal';
import { ShopOwnerDashboard } from './components/ShopOwnerDashboard';
import { SuperAdminControlPlane } from './components/SuperAdminControlPlane';

export function App() {
  const [initialQr] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('qr');
    }
    return null;
  });

  // If ?qr is in URL, customer scanned a QR code — display customer print kiosk!
  // Otherwise default directly to Shop Owner dashboard / login.
  const [activeTab, setActiveTab] = useState<'customer' | 'dashboard' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qr')) return 'customer';
    }
    return 'dashboard';
  });

  // Dedicated Customer Mobile Kiosk Mode (when customer scans counter QR poster)
  if (initialQr || activeTab === 'customer') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40 shadow-2xs">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm shadow-[#4F46E5]/20">
                <Printer className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-[#0F172A]">PrintEase</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Self-Service
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Shopkeeper Login ➔
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto px-4 py-6 w-full">
          <CustomerPrintPortal defaultQrToken={initialQr || 'default'} />
        </main>
      </div>
    );
  }

  // Shop Owner / Super Admin Mode
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
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Shop Owner</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Super Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'dashboard' ? (
          <ShopOwnerDashboard />
        ) : (
          <SuperAdminControlPlane />
        )}
      </main>
    </div>
  );
}

export default App;
