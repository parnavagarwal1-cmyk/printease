import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  LogOut, 
  Layers,
  Trash2,
  Lock,
  KeyRound
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';

export const SuperAdminControlPlane: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('printease_admin_token'));
  const [user, setUser] = useState<any | null>(null);

  // Login error state
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Data
  const [metrics, setMetrics] = useState<any | null>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'audit' | 'plans' | 'security'>('overview');

  // Admin Profile & Security state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Verify and fetch user
  const fetchAdminUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user.role === 'super_admin') {
          setUser(data.user);
          setAdminName(data.user.name || '');
          setAdminEmail(data.user.email || '');
        } else {
          setLoginError('You do not have super admin privileges.');
          localStorage.removeItem('printease_admin_token');
          setToken(null);
        }
      }
    } catch {
      localStorage.removeItem('printease_admin_token');
      setToken(null);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

      const [mRes, sRes, aRes, pRes] = await Promise.all([
        fetch('/api/admin/metrics', { headers }),
        fetch('/api/admin/shops', { headers }),
        fetch('/api/admin/audit-logs', { headers }),
        fetch('/api/admin/plans', { headers }),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData.metrics);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setShops(sData.shops || []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAuditLogs(aData.audit_logs || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(pData.plans || []);
      }
    } catch (err) {
      console.error('Fetch admin data error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAdminUser(token);
      fetchAdminData();
    }
  }, [token, fetchAdminUser, fetchAdminData]);

  const handleLogout = () => {
    localStorage.removeItem('printease_admin_token');
    setToken(null);
    setUser(null);
  };

  const handleGoogleAdminSuccess = (data: { token: string; user: any }) => {
    if (data.user.role !== 'super_admin') {
      setLoginError(`Access denied: ${data.user.email} is not authorized as Super Administrator. Platform root access is restricted to parnavagarwal1@gmail.com.`);
      return;
    }

    localStorage.setItem('printease_admin_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setAdminName(data.user.name || '');
    setAdminEmail(data.user.email || '');
    setLoginError(null);
  };

  const handleToggleShopStatus = async (shopId: number, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    try {
      const res = await fetch(`/api/admin/shops/${shopId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const handleDeleteShop = async (shopId: number, shopName: string) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Are you sure you want to completely delete "${shopName}"?\n\nThis will permanently delete the shop, its branches, printers, paired agents, and all order records.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        fetchAdminData();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to remove shop');
      }
    } catch (err) {
      console.error('Delete shop error:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const payload: any = {
        name: adminName,
        email: adminEmail,
      };
      if (adminNewPassword) {
        payload.new_password = adminNewPassword;
        if (adminCurrentPassword) {
          payload.current_password = adminCurrentPassword;
        }
      }

      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update admin profile');
      }

      setUser(data.user);
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setProfileSuccess(data.message || 'Super Admin credentials updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Error updating credentials');
    } finally {
      setProfileLoading(false);
    }
  };

  if (!token || !user) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Super Admin Control Plane</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Platform-wide multi-shop governance, telemetry & billing management
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-sm text-slate-900">Sign in with Google</h3>
            <p className="text-xs text-slate-500">
              Restricted exclusively to authorized platform administrators
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <GoogleSignInButton
            onSuccess={handleGoogleAdminSuccess}
            buttonText="signin_with"
            roleHint="super_admin"
          />

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-start gap-2.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Root access protected by Google Identity Services & role-based verification.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-indigo-600/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">PrintEase Super Admin</h2>
              <span className="text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full uppercase">
                Platform Root
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Authenticated as <strong>{user.email}</strong> • Global Multi-Tenant Control Plane
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh All Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Total Shops</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.total_shops}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">{metrics.total_branches} active branches</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Gross Platform GMV</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">₹{metrics.gross_platform_volume.toFixed(2)}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Paid via Razorpay</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Prints Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.total_prints_completed}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">{metrics.total_orders} total orders</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Active Subscriptions</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.active_subscriptions_count}</div>
            <span className="text-[11px] text-indigo-600 font-semibold mt-1 block">Recurring MRR</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Platform Overview
        </button>

        <button
          onClick={() => setActiveTab('shops')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'shops' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Shops ({shops.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Global Audit Trail ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'plans' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          SaaS Plans & Quotas
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'security' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Security & Login</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Subscription Plan Breakdown</h3>
            <div className="space-y-3">
              {metrics.plans_breakdown?.map((p: any) => (
                <div key={p.slug} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{p.name} Plan</div>
                    <div className="text-[11px] text-slate-500">₹{p.monthly_price}/month</div>
                  </div>
                  <span className="font-bold text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                    {p.active_subscribers} Shops
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Hardware Fleet Health</h3>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-slate-600 font-semibold">Total Physical Printers:</span>
                <span className="font-bold font-mono text-slate-900">{metrics.total_printers}</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-slate-600 font-semibold">Total Paired Desktop PCs:</span>
                <span className="font-bold font-mono text-slate-900">{metrics.total_desktop_devices}</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/60 border-emerald-200 flex items-center justify-between">
                <span className="text-emerald-800 font-semibold">Online Windows Agents:</span>
                <span className="font-bold font-mono text-emerald-800">{metrics.online_desktop_devices}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Shops Table */}
      {activeTab === 'shops' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3">Shop Name</th>
                  <th className="px-6 py-3">Owner</th>
                  <th className="px-6 py-3">Branches</th>
                  <th className="px-6 py-3">Active Plan</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-slate-900">{s.name}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{s.owner?.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.owner?.email}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{s.branches_count || s.branches?.length}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                        {s.active_subscription?.plan?.name || 'Starter'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleShopStatus(s.id, s.status)}
                          className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                            s.status === 'active'
                              ? 'text-amber-600 hover:bg-amber-50 border border-amber-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
                          }`}
                        >
                          {s.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteShop(s.id, s.name)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title={`Permanently delete ${s.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Global Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Shop</th>
                  <th className="px-6 py-3">Actor</th>
                  <th className="px-6 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900 font-mono text-[11px]">
                      {log.action}
                    </td>
                    <td className="px-6 py-3 text-slate-700">{log.shop?.name || '-'}</td>
                    <td className="px-6 py-3 text-slate-500">{log.user?.email || 'System / Customer'}</td>
                    <td className="px-6 py-3 text-slate-400 font-mono text-[11px]">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Plans & Limits */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-900">{p.name}</h3>
                <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-mono">
                  ₹{p.monthly_price}/mo
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 border-t border-b border-slate-100 py-4">
                <div className="flex justify-between">
                  <span>Max Branches:</span>
                  <span className="font-bold text-slate-900">{p.max_branches >= 999 ? 'Unlimited' : p.max_branches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Printers per Branch:</span>
                  <span className="font-bold text-slate-900">{p.max_printers_per_branch >= 999 ? 'Unlimited' : p.max_printers_per_branch}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Prints:</span>
                  <span className="font-bold text-slate-900">{p.monthly_print_limit ? p.monthly_print_limit : 'Unlimited'}</span>
                </div>
              </div>

              <span className="block text-[11px] text-center text-emerald-600 font-semibold">
                ✓ Tier Active in Database
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Admin Security & Credentials */}
      {activeTab === 'security' && (
        <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>Super Administrator Credentials</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Update your root Super Admin email address, display name, and password for PrintEase.
            </p>
          </div>

          {profileSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Admin Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Super Admin Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                  placeholder="admin@yourdomain.com"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Password (Leave blank to keep unchanged)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={adminCurrentPassword}
                    onChange={e => setAdminCurrentPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={adminNewPassword}
                    onChange={e => setAdminNewPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {profileLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Update Credentials</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
