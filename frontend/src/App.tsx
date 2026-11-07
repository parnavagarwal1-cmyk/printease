import { useState } from 'react';
import { 
  Printer, 
  QrCode, 
  Key,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { CustomerPrintPortal } from './components/CustomerPrintPortal';
import { ShopOwnerDashboard } from './components/ShopOwnerDashboard';
import { SuperAdminControlPlane } from './components/SuperAdminControlPlane';
import { PairingHelperModal } from './components/PairingHelperModal';

export function App() {
  const [initialQr] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('qr');
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'customer' | 'dashboard' | 'admin'>('customer');
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false);

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
              Shop Owner
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Super Admin
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
            defaultQrToken={initialQr || "pe_demo_connaught_branch_token_99"} 
            onOpenPairingInfo={() => setShowPairingModal(true)}
          />
        ) : activeTab === 'dashboard' ? (
          <ShopOwnerDashboard />
        ) : (
          <SuperAdminControlPlane />
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
