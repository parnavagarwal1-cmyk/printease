import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  DollarSign, 
  ShoppingBag, 
  Printer, 
  Monitor, 
  QrCode, 
  RefreshCw, 
  Plus, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  LogOut
} from 'lucide-react';

export const ShopOwnerDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('printease_token'));
  const [user, setUser] = useState<any | null>(null);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('owner@metroprint.com');
  const [loginPassword, setLoginPassword] = useState('Secret@12345');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders' | 'pricing' | 'poster' | 'hardware'>('analytics');
  const [loading, setLoading] = useState<boolean>(false);
  const [savingPrices, setSavingPrices] = useState<boolean>(false);
  const [priceSaveSuccess, setPriceSaveSuccess] = useState<boolean>(false);

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
          setActiveBranchId(data.branches[0].id);
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

      // C: Branch Details (Printers, Pricing, Devices)
      const brRes = await fetch(`/api/branches/${activeBranchId}`, { headers });
      if (brRes.ok) {
        const brData = await brRes.json();
        setPricingRules(brData.branch?.pricing_rules || []);
        setPrinters(brData.branch?.printers || []);
        setDevices(brData.branch?.desktop_devices || []);
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

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-6 text-white text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Shop Owner Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Sign in to manage your branch fleet, prices & queues</p>
        </div>

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
        </form>
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
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Recent Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'pricing'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Pricing Configuration
        </button>

        <button
          onClick={() => setActiveTab('poster')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'poster'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Printable QR Poster
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
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

      {/* Tab 3: Printable QR Poster */}
      {activeTab === 'poster' && posterData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Branch QR Poster Template</h3>
              <p className="text-xs text-slate-500">Print and display this high-contrast poster at your counter</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Poster</span>
            </button>
          </div>

          {/* Realistic A4 Poster Preview */}
          <div className="max-w-md mx-auto border-4 border-indigo-600 rounded-3xl p-8 bg-white text-center shadow-xl space-y-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto">
              <Printer className="w-6 h-6" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">{posterData.shop_name}</h1>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mt-1">{posterData.branch_name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{posterData.branch_address}</p>
            </div>

            {/* Simulated High-Contrast QR */}
            <div className="w-48 h-48 mx-auto bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-white relative shadow-inner">
              <QrCode className="w-32 h-32 text-white" />
              <span className="text-[10px] font-mono tracking-widest text-slate-300 mt-1">SCAN TO PRINT</span>
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
    </div>
  );
};
