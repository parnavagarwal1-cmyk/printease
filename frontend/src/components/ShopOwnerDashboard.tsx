import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  DollarSign, 
  ShoppingBag, 
  Printer, 
  Monitor, 
  RefreshCw, 
  Plus, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  LogOut,
  Store,
  UserPlus,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  User as UserIcon,
  Wallet,
  Volume2,
  QrCode,
  ShieldCheck
} from 'lucide-react';

export const ShopOwnerDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('printease_token'));
  const [user, setUser] = useState<any | null>(null);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('owner@metroprint.com');
  const [loginPassword, setLoginPassword] = useState('Secret@12345');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auth Mode: login vs register
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regShopName, setRegShopName] = useState('');
  const [regBranchName, setRegBranchName] = useState('Main Branch');
  const [regCity, setRegCity] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Add Branch modal state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);

  // Dashboard Data State
  const [activeBranchId, setActiveBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [posterData, setPosterData] = useState<any | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders' | 'pricing' | 'payments' | 'poster' | 'hardware'>('analytics');
  const [loading, setLoading] = useState<boolean>(false);
  const [savingPrices, setSavingPrices] = useState<boolean>(false);
  const [priceSaveSuccess, setPriceSaveSuccess] = useState<boolean>(false);

  // Payments & UPI configuration state
  const [merchantVpa, setMerchantVpa] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('');
  const [soundboxProvider, setSoundboxProvider] = useState<string>('paytm');
  const [savingPayments, setSavingPayments] = useState<boolean>(false);
  const [paymentSaveSuccess, setPaymentSaveSuccess] = useState<boolean>(false);
  const [paymentSaveError, setPaymentSaveError] = useState<string | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<string | null>(null);

  // Pairing code modal
  const [newPairingCode, setNewPairingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

  // 1. Fetch User / Branches on Token
  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('printease_token');
        setToken(null);
      }
    } catch {
      localStorage.removeItem('printease_token');
      setToken(null);
    }
  }, []);

  const fetchBranches = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/branches', {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
        if (data.branches && data.branches.length > 0) {
          const firstBranch = data.branches[0];
          setActiveBranchId(firstBranch.id);
          setMerchantVpa(firstBranch.merchant_vpa || '');
          setMerchantName(firstBranch.merchant_name || firstBranch.name || '');
          setSoundboxProvider(firstBranch.soundbox_provider || 'paytm');
        }
      }
    } catch (err) {
      console.error('Fetch branches error:', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
      fetchBranches(token);
    }
  }, [token, fetchCurrentUser, fetchBranches]);

  // 2. Fetch Branch-Specific Data
  const fetchBranchData = useCallback(async () => {
    if (!token || !activeBranchId) return;
    setLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

      // A: Analytics
      const anRes = await fetch(`/api/branches/${activeBranchId}/analytics`, { headers });
      if (anRes.ok) {
        const anData = await anRes.json();
        setAnalytics(anData.analytics);
      }

      // B: Orders
      const ordRes = await fetch(`/api/branches/${activeBranchId}/orders`, { headers });
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }

      // C: Branch Details (Printers, Pricing, Devices, UPI Payment Settings)
      const brRes = await fetch(`/api/branches/${activeBranchId}`, { headers });
      if (brRes.ok) {
        const brData = await brRes.json();
        setPricingRules(brData.branch?.pricing_rules || []);
        setPrinters(brData.branch?.printers || []);
        setDevices(brData.branch?.desktop_devices || []);
        if (brData.branch) {
          setMerchantVpa(brData.branch.merchant_vpa || '');
          setMerchantName(brData.branch.merchant_name || brData.branch.name || '');
          setSoundboxProvider(brData.branch.soundbox_provider || 'paytm');
        }
      }

      // D: QR Poster Data
      const posRes = await fetch(`/api/branches/${activeBranchId}/qr-poster`, { headers });
      if (posRes.ok) {
        const posData = await posRes.json();
        setPosterData(posData.poster);
      }
    } catch (err) {
      console.error('Branch data error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, activeBranchId]);

  useEffect(() => {
    if (token && activeBranchId) {
      fetchBranchData();
    }
  }, [token, activeBranchId, fetchBranchData]);

  // 3. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      localStorage.setItem('printease_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      }).catch(() => {});
    }
    localStorage.removeItem('printease_token');
    setToken(null);
    setUser(null);
  };

  // Register New Shop & Owner
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regPasswordConfirm) {
      setRegisterError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 8) {
      setRegisterError('Password must be at least 8 characters long.');
      return;
    }
    setRegistering(true);
    setRegisterError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          password_confirmation: regPasswordConfirm,
          phone: regPhone || undefined,
          shop_name: regShopName,
          branch_name: regBranchName || 'Main Branch',
          city: regCity || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.errors 
          ? Object.values(data.errors).flat().join(' ') 
          : (data.message || 'Registration failed.');
        throw new Error(errorMsg);
      }

      localStorage.setItem('printease_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setRegisterError(err.message || 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  // Create Additional Branch for Current Shop
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const currentShopId = branches.find(b => b.id === activeBranchId)?.shop_id || branches[0]?.shop_id;
    if (!currentShopId) {
      setCreateBranchError('No active shop found.');
      return;
    }

    setCreatingBranch(true);
    setCreateBranchError(null);
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          shop_id: currentShopId,
          name: newBranchName,
          city: newBranchCity || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create branch.');
      }

      setShowAddBranchModal(false);
      setNewBranchName('');
      setNewBranchCity('');
      await fetchBranches(token);
      if (data.branch?.id) {
        setActiveBranchId(data.branch.id);
      }
    } catch (err: any) {
      setCreateBranchError(err.message || 'Failed to create branch.');
    } finally {
      setCreatingBranch(false);
    }
  };

  // 4. Save Pricing Rules
  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeBranchId) return;

    setSavingPrices(true);
    try {
      const res = await fetch(`/api/branches/${activeBranchId}/pricing-rules`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ rules: pricingRules }),
      });

      if (res.ok) {
        setPriceSaveSuccess(true);
        setTimeout(() => setPriceSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Save prices error:', err);
    } finally {
      setSavingPrices(false);
    }
  };

  // 4b. Save UPI & Soundbox Payment Settings
  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeBranchId) return;

    if (!merchantVpa.trim()) {
      setPaymentSaveError('Please enter a valid UPI ID (VPA), e.g. 9876543210@paytm or yourname@okhdfcbank');
      return;
    }

    setSavingPayments(true);
    setPaymentSaveSuccess(false);
    setPaymentSaveError(null);

    try {
      const res = await fetch(`/api/branches/${activeBranchId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          merchant_vpa: merchantVpa.trim(),
          merchant_name: merchantName.trim() || undefined,
          soundbox_provider: soundboxProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update payment settings.');
      }

      setPaymentSaveSuccess(true);
      setTimeout(() => setPaymentSaveSuccess(false), 3500);

      // Update in memory branches list
      setBranches(prev => prev.map(b => b.id === activeBranchId ? {
        ...b,
        merchant_vpa: merchantVpa.trim(),
        merchant_name: merchantName.trim() || b.name,
        soundbox_provider: soundboxProvider
      } : b));

      // Refresh QR poster data
      const posRes = await fetch(`/api/branches/${activeBranchId}/qr-poster`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      if (posRes.ok) {
        const posData = await posRes.json();
        setPosterData(posData.poster);
      }
    } catch (err: any) {
      setPaymentSaveError(err.message || 'Error saving payment settings');
    } finally {
      setSavingPayments(false);
    }
  };

  const handleCopyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhookUrl(url);
    setTimeout(() => setCopiedWebhookUrl(null), 2500);
  };

  // 5. Generate New Pairing Code
  const handleGeneratePairingCode = async () => {
    if (!token || !activeBranchId) return;

    try {
      const res = await fetch(`/api/branches/${activeBranchId}/pairing-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ device_name: 'Counter PC' }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewPairingCode(data.pairing_code);
        fetchBranchData();
      }
    } catch (err) {
      console.error('Pairing code gen error:', err);
    }
  };

  // 6. Shop Counter Manual Approval (Soundbox Audio Heard)
  const handleApproveSoundboxOrder = async (orderNumber: string) => {
    setApprovingOrderId(orderNumber);
    try {
      const res = await fetch('/api/webhooks/soundbox/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_number: orderNumber,
          provider: 'paytm',
        }),
      });
      if (res.ok) {
        await fetchBranchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to approve order');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setApprovingOrderId(null);
    }
  };

  // 7. High-Resolution Dedicated A4 Poster Printing
  const handlePrintPoster = () => {
    if (!posterData) return;
    const qrUrl =
      posterData.qr_image_url ||
      `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=15&data=${encodeURIComponent(
        `${window.location.origin}/?qr=${posterData.qr_token}`
      )}`;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${posterData.shop_name} - Counter QR Standee</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .poster-card {
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
      border: 4px solid #4338ca;
      border-radius: 28px;
      padding: 36px 32px;
      text-align: center;
      box-shadow: none;
      page-break-inside: avoid;
    }
    .badge-icon {
      width: 54px;
      height: 54px;
      background: #4f46e5;
      color: white;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 26px;
    }
    h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 28px;
      font-weight: 900;
      margin: 0 0 6px 0;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .branch-name {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #4f46e5;
      margin: 0 0 4px 0;
    }
    .branch-address {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 20px 0;
    }
    .qr-box {
      background: #ffffff;
      border: 3px solid #0f172a;
      border-radius: 24px;
      padding: 16px;
      display: inline-block;
      margin: 0 auto 16px;
    }
    .qr-img {
      width: 260px;
      height: 260px;
      display: block;
      border-radius: 12px;
    }
    .scan-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .instructions-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 18px;
      text-align: left;
      margin-bottom: 20px;
    }
    .instructions-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #334155;
      margin-bottom: 8px;
    }
    .step-row {
      font-size: 13px;
      color: #475569;
      margin: 6px 0;
      line-height: 1.4;
    }
    .step-row strong {
      color: #0f172a;
    }
    .footer-note {
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 14px;
    }
  </style>
</head>
<body>
  <div class="poster-card">
    <div class="badge-icon">🖨️</div>
    <h1>${posterData.shop_name}</h1>
    <div class="branch-name">${posterData.branch_name}</div>
    <div class="branch-address">${posterData.branch_address || ''}</div>

    <div class="qr-box">
      <img class="qr-img" src="${qrUrl}" alt="Scan to print">
    </div>

    <div class="scan-badge">
      📷 Scan with Smartphone Camera or Google Lens
    </div>

    <div class="instructions-box">
      <div class="instructions-title">HOW TO SELF-PRINT:</div>
      <div class="step-row"><strong>1. Scan QR Code</strong> with your phone camera</div>
      <div class="step-row"><strong>2. Upload PDF</strong> document & choose Color / B&W</div>
      <div class="step-row"><strong>3. Pay via UPI / Soundbox</strong> & collect your print</div>
    </div>

    <div class="footer-note">
      Powered by PrintEase Cloud • Instant Hardware Spooler
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  if (!token) {
    return (
      <div className="max-w-lg mx-auto my-10 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Card Header */}
        <div className="bg-slate-900 px-6 py-6 text-white text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-600/30">
            {authMode === 'login' ? <Building2 className="w-6 h-6" /> : <Store className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">PrintEase Shop Portal</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {authMode === 'login'
              ? 'Sign in to access your print counters, queues & pricing rules'
              : 'Register your print shop & launch customer self-service QR in seconds'}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Register New Shop */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setLoginError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setRegisterError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              authMode === 'register'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register New Shop</span>
          </button>
        </div>

        {/* MODE 1: Login Form */}
        {authMode === 'login' ? (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900">
              <strong>Pre-Filled Test Credentials:</strong>
              <p className="mt-0.5">Email: <code>owner@metroprint.com</code></p>
              <p>Password: <code>Secret@12345</code></p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loggingIn ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>Sign In to Dashboard</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                Don't have a shop account? Register your shop →
              </button>
            </div>
          </form>
        ) : (
          /* MODE 2: Register New Shop Form */
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                <span>Shop / Business Name *</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Xerox & Print Hub"
                value={regShopName}
                onChange={(e) => setRegShopName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Owner Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Phone / WhatsApp</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Login Email Address *</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. rahul@apexprint.in"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Initial Branch / Counter</label>
                <input
                  type="text"
                  placeholder="e.g. Main Counter"
                  value={regBranchName}
                  onChange={(e) => setRegBranchName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>City</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. New Delhi"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Password (min 8 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Confirm Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {registerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={registering}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {registering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Configuring Shop & Generating QR...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Register Shop & Launch Counter</span>
                </>
              )}
            </button>

            <div className="text-[11px] text-slate-400 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              ✨ Automatically configures your shop, branch counter, default A4/A3 pricing rules, and printable customer QR poster.
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                Already have an account? Sign in here →
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 font-bold text-xl">
            {branches.find(b => b.id === activeBranchId)?.name?.charAt(0) || 'M'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                {branches.find(b => b.id === activeBranchId)?.name || 'Main Branch'}
              </h2>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                Active Tenant
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Logged in as <strong className="text-slate-700">{user?.name}</strong> ({user?.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {branches.length > 1 && (
            <select
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(Number(e.target.value))}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              setShowAddBranchModal(true);
              setCreateBranchError(null);
            }}
            className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Add another counter or branch"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Branch</span>
          </button>

          <button
            onClick={fetchBranchData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Today's Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">₹{analytics.revenue_today.toFixed(2)}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Live collected</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Orders Today</span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.orders_today_count}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Customer uploads</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Completed Prints</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.completed_prints_today}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Spooled successfully</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Active Printers</span>
              <Printer className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.active_printers_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Branch hardware</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Windows Agents</span>
              <Monitor className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{devices.length}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
              {devices.filter(d => d.status === 'online').length} online
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Recent Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 ${
            activeTab === 'pricing'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Pricing Configuration
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>UPI & Online Payments</span>
          {!merchantVpa && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="UPI ID not set"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('poster')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 ${
            activeTab === 'poster'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Printable QR Poster
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 ${
            activeTab === 'hardware'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Hardware & Windows Agents
        </button>
      </div>

      {/* Tab 1: Orders Table */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Live Customer Orders</h3>
            <span className="text-xs text-slate-500">Auto-synced</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Print Job</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Counter Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      No customer orders recorded yet today.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{order.order_number}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{order.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{order.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">₹{parseFloat(order.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'PRINT_QUEUED' ? 'bg-indigo-100 text-indigo-800' :
                          order.status === 'PRINTING' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-[11px]">
                        {order.print_jobs && order.print_jobs.length > 0 ? (
                          `PJ-#${order.print_jobs[0].id} (${order.print_jobs[0].status})`
                        ) : 'Pending Pay'}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {order.status === 'UPLOADED' || order.status === 'PAYMENT_PENDING' ? (
                          <button
                            onClick={() => handleApproveSoundboxOrder(order.order_number)}
                            disabled={approvingOrderId === order.order_number}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm inline-flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Click once you hear Soundbox voice announce payment"
                          >
                            {approvingOrderId === order.order_number ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <span>🔊 Soundbox Received (Print)</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pricing Rules Form */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePrices} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Branch Pricing Matrix</h3>
              <p className="text-xs text-slate-500">Configure single-side, double-side (duplex), minimum order and GST</p>
            </div>
            {priceSaveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Saved successfully!</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pricingRules.map((rule, idx) => (
              <div key={rule.paper_size || idx} className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base text-slate-900">{rule.paper_size} Paper Size</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                    Configured
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">B&W Single (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={rule.bw_single_price}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].bw_single_price = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">B&W Duplex (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={rule.bw_duplex_price}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].bw_duplex_price = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Color Single (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={rule.color_single_price}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].color_single_price = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Color Duplex (₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={rule.color_duplex_price}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].color_duplex_price = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Min Order (₹)</label>
                    <input
                      type="number"
                      step="1"
                      value={rule.min_order_amount}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].min_order_amount = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">GST Tax (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={rule.tax_rate_percent}
                      onChange={(e) => {
                        const copy = [...pricingRules];
                        copy[idx].tax_rate_percent = parseFloat(e.target.value) || 0;
                        setPricingRules(copy);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingPrices}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save & Publish Prices</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab: UPI & Online Payments Setup */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          {merchantVpa ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">Direct Bank UPI Payments Active</h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Customer terminal transfers are routed directly to <strong className="font-mono bg-emerald-100/70 px-1.5 py-0.5 rounded text-emerald-900">{merchantVpa}</strong> ({merchantName || 'Branch'})
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-600 text-white uppercase tracking-wider shrink-0 self-start sm:self-center">
                Live & Receiving Funds
              </span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">UPI ID Not Configured</h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Please configure your shop's UPI ID below so customers can scan and pay directly into your bank account.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500 text-white uppercase tracking-wider shrink-0 self-start sm:self-center">
                Setup Required
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: UPI Configuration Form (7 cols) */}
            <form onSubmit={handleSavePayments} className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Bank UPI & Soundbox Settings</h3>
                  <p className="text-xs text-slate-500">Payments will be deposited directly to this UPI address</p>
                </div>
                {paymentSaveSuccess && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved successfully!</span>
                  </span>
                )}
              </div>

              {paymentSaveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentSaveError}</span>
                </div>
              )}

              {/* Field 1: UPI ID (VPA) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Shop UPI ID (Virtual Payment Address) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={merchantVpa}
                    onChange={(e) => setMerchantVpa(e.target.value)}
                    placeholder="e.g. 9876543210@paytm, midtown@okhdfcbank"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  GPay, PhonePe, Paytm, and BHIM transfers from customers will be credited to this UPI ID.
                </p>

                {/* Quick handle suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Quick Suffixes:</span>
                  {['@paytm', '@okhdfcbank', '@okaxis', '@ybl', '@ibl'].map(suffix => (
                    <button
                      type="button"
                      key={suffix}
                      onClick={() => {
                        const base = merchantVpa.split('@')[0];
                        if (base) setMerchantVpa(`${base}${suffix}`);
                        else setMerchantVpa(`shop${suffix}`);
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-mono transition-colors cursor-pointer"
                    >
                      {suffix}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 2: Merchant Display Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Payee / Business Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Store className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="e.g. Midtown Stationary & Cyber Cafe"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Shown to the customer on their UPI payment screen as the payee name.
                </p>
              </div>

              {/* Field 3: Verification & Soundbox Provider */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Counter Payment Verification & Hardware Soundbox
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'paytm', name: 'Paytm Soundbox', desc: 'Paytm for Business speaker & webhook', badge: 'Recommended' },
                    { id: 'phonepe', name: 'PhonePe SmartSpeaker', desc: 'PhonePe Business merchant notifications', badge: 'Popular' },
                    { id: 'gpay', name: 'Google Pay Soundbox', desc: 'Google Pay for Business device', badge: 'Standard' },
                    { id: 'direct_upi', name: 'Direct UPI / Manual', desc: 'Counter staff checks phone & prints', badge: 'Self-Serve' },
                  ].map(provider => (
                    <div
                      key={provider.id}
                      onClick={() => setSoundboxProvider(provider.id)}
                      className={`p-3 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                        soundboxProvider === provider.id
                          ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{provider.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          soundboxProvider === provider.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {provider.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{provider.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Changes take effect immediately on counter terminals.
                </div>
                <button
                  type="submit"
                  disabled={savingPayments}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPayments ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save UPI Settings</span>
                </button>
              </div>
            </form>

            {/* Right Column: Live Terminal Simulator & Webhook Guide (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Dynamic Customer Terminal Preview */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-xs text-slate-900">Customer Mobile Terminal Preview</h4>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Live Demo
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                      {soundboxProvider === 'phonepe' ? 'PhonePe SmartSpeaker' : 'Paytm Soundbox'} Active
                    </span>
                    <h5 className="text-sm font-extrabold text-slate-900">Scan & Pay ₹10.00</h5>
                    <p className="text-[11px] text-slate-600">
                      Paying: <strong className="text-slate-800">{merchantName || 'Midtown Stationary'}</strong>
                    </p>
                    <p className="text-[10px] font-mono text-indigo-600 font-semibold">
                      {merchantVpa || 'your-upi-id@bank'}
                    </p>
                  </div>

                  {/* QR Image */}
                  <div className="inline-block p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
                        `upi://pay?pa=${merchantVpa || 'merchant@upi'}&pn=${encodeURIComponent(merchantName || 'Shop')}&am=10.00&cu=INR&tn=PrintEase Order Test`
                      )}`}
                      alt="UPI QR Code Preview"
                      className="w-32 h-32 mx-auto"
                    />
                  </div>

                  {/* UPI Apps preview */}
                  <div className="flex justify-center gap-1.5 pt-1">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded text-[10px] font-bold">
                      GPay
                    </span>
                    <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded text-[10px] font-bold">
                      PhonePe
                    </span>
                    <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded text-[10px] font-bold">
                      Paytm
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  💡 <strong>How it works:</strong> When a customer selects copies and page range at your counter, PrintEase generates this dynamic QR code with your UPI ID. All funds go directly into your linked bank account!
                </div>
              </div>

              {/* Soundbox Webhook Integration Guide */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-indigo-300">
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">Instant Soundbox Webhook</h4>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  To automatically trigger printing when your counter Soundbox announces payment, paste this webhook in your <strong>Paytm for Business</strong> or <strong>PhonePe Merchant</strong> dashboard:
                </p>

                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                    Your Webhook Endpoint URL:
                  </span>
                  <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 font-mono text-[11px] text-emerald-400">
                    <span className="truncate flex-1">
                      {window.location.origin}/api/soundbox/{soundboxProvider === 'phonepe' ? 'phonepe' : 'paytm'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyWebhook(`${window.location.origin}/api/soundbox/${soundboxProvider === 'phonepe' ? 'phonepe' : 'paytm'}`)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    >
                      {copiedWebhookUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWebhookUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Secure bank verification ensures zero unpaid prints.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Printable QR Poster */}
      {activeTab === 'poster' && posterData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Branch QR Poster Template</h3>
              <p className="text-xs text-slate-500">Print and display this high-contrast poster at your counter</p>
            </div>
            <button
              onClick={handlePrintPoster}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Poster</span>
            </button>
          </div>

          {/* Realistic A4 Poster Preview */}
          <div id="printable-branch-poster" className="max-w-md mx-auto border-4 border-indigo-600 rounded-3xl p-8 bg-white text-center shadow-xl space-y-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">{posterData.shop_name}</h1>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mt-1">{posterData.branch_name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{posterData.branch_address}</p>
            </div>

            {/* Authentic Scannable QR Code */}
            <div className="w-56 h-56 mx-auto bg-white rounded-2xl p-2.5 border-2 border-slate-900 shadow-md flex flex-col items-center justify-center">
              <img
                src={
                  posterData.qr_image_url ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(
                    `${window.location.origin}/?qr=${posterData.qr_token}`
                  )}`
                }
                alt={`Scan QR code to print at ${posterData.shop_name}`}
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>
            <div className="text-center font-mono text-[11px] font-bold text-slate-700 bg-slate-100 py-1.5 px-3 rounded-lg inline-block mx-auto border border-slate-200">
              Scan with Smartphone Camera, Google Lens or iPhone Camera
            </div>

            <div className="space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">How to Print:</span>
              <div className="space-y-1.5 text-xs text-slate-600">
                <p>1. Scan this QR code with smartphone camera</p>
                <p>2. Upload your PDF document (up to 50MB)</p>
                <p>3. Pay via UPI / Card & collect your print</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
              Powered by PrintEase Cloud • Instant Local Spooler
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Hardware & Windows Agents */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Paired Windows Desktop Agents</h3>
                <p className="text-xs text-slate-500">Windows PC clients running PrintEase Spooler daemon</p>
              </div>
              <button
                onClick={handleGeneratePairingCode}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pair New PC</span>
              </button>
            </div>

            {newPairingCode && (
              <div className="my-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase">Single-Use Pairing Code (15 min):</span>
                  <div className="font-mono text-xl font-black text-emerald-950 mt-1">{newPairingCode}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newPairingCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-100 mt-4">
              {devices.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">No Windows PCs paired yet.</div>
              ) : (
                devices.map(dev => (
                  <div key={dev.id} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">{dev.device_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">UUID: {dev.device_uuid}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        dev.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {dev.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {dev.last_heartbeat_at ? `Heartbeat: ${new Date(dev.last_heartbeat_at).toLocaleTimeString()}` : 'Never'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-sm text-slate-900 mb-4">Branch Printers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {printers.map(p => (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.supports_color ? 'Color + B&W' : 'Monochrome only'} • {p.supports_duplex ? 'Duplex' : 'Simplex'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">Add Branch or Counter</h3>
              </div>
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Branch / Counter Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Counter 2 (Ground Floor) or Karol Bagh Branch"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. New Delhi"
                  value={newBranchCity}
                  onChange={(e) => setNewBranchCity(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {createBranchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createBranchError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBranch}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {creatingBranch ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Branch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
