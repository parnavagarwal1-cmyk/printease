import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  CreditCard, 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';
import type { 
  QrResolutionResponse, 
  UploadedFileMeta, 
  PricingBreakdown, 
  CreatedOrder 
} from '../types';

interface Props {
  defaultQrToken?: string;
  onOpenPairingInfo?: () => void;
}

export const CustomerPrintPortal: React.FC<Props> = ({ 
  defaultQrToken = 'pe_demo_connaught_branch_token_99',
  onOpenPairingInfo
}) => {
  const [qrToken, setQrToken] = useState<string>(defaultQrToken);
  const [branchData, setBranchData] = useState<QrResolutionResponse | null>(null);
  const [loadingBranch, setLoadingBranch] = useState<boolean>(true);
  const [branchError, setBranchError] = useState<string | null>(null);

  // File Upload state
  const [uploadedFile, setUploadedFile] = useState<UploadedFileMeta | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Print Configuration state
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [duplexMode, setDuplexMode] = useState<'single' | 'duplex'>('single');
  const [paperSize, setPaperSize] = useState<string>('A4');
  const [copies, setCopies] = useState<number>(1);
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('');

  // Pricing calculation state
  const [estimate, setEstimate] = useState<PricingBreakdown | null>(null);
  const [calculating, setCalculating] = useState<boolean>(false);

  // Customer contact state
  const [customerName, setCustomerName] = useState<string>('Rahul Verma');
  const [customerPhone, setCustomerPhone] = useState<string>('+919876543210');
  const [customerEmail, setCustomerEmail] = useState<string>('rahul@example.com');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Order submission state
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState<boolean>(false);

  // Payment state
  const [paying, setPaying] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'soundbox' | 'razorpay'>('soundbox');
  const [upiData, setUpiData] = useState<any>(null);

  // 1. Resolve Branch Details from QR Token
  const resolveBranch = useCallback(async (token: string) => {
    setLoadingBranch(true);
    setBranchError(null);
    try {
      const res = await fetch(`/api/public/qr/${encodeURIComponent(token.trim())}`);
      if (!res.ok) {
        throw new Error(`Invalid or inactive QR code (${res.status})`);
      }
      const data: QrResolutionResponse = await res.json();
      setBranchData(data);
      if (data.pricing_rules.length > 0) {
        setPaperSize(data.pricing_rules[0].paper_size);
      }
    } catch (err: any) {
      setBranchError(err.message || 'Failed to scan shop QR code.');
      setBranchData(null);
    } finally {
      setLoadingBranch(false);
    }
  }, []);

  useEffect(() => {
    if (defaultQrToken && defaultQrToken !== qrToken) {
      setQrToken(defaultQrToken);
    }
  }, [defaultQrToken]);

  useEffect(() => {
    if (qrToken) {
      resolveBranch(qrToken);
    }
  }, [qrToken, resolveBranch]);

  // 2. Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setUploadError('Please select a valid PDF file (.pdf).');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      setUploadedFile(data.file);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file.');
    } finally {
      setUploading(false);
    }
  };

  // 3. Live Pricing Estimate
  useEffect(() => {
    if (!branchData || !uploadedFile) return;

    const timer = setTimeout(async () => {
      setCalculating(true);
      try {
        const range = pageRangeMode === 'custom' ? customPageRange : 'all';
        const res = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                total_pages: uploadedFile.page_count,
                page_range: range,
                copies,
                color_mode: colorMode,
                duplex_mode: duplexMode,
                paper_size: paperSize,
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setEstimate(data);
        }
      } catch (err) {
        console.error('Estimate error:', err);
      } finally {
        setCalculating(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [branchData, uploadedFile, colorMode, duplexMode, paperSize, copies, pageRangeMode, customPageRange, qrToken]);

  // 4. Create Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !branchData) return;

    setSubmittingOrder(true);
    setOrderError(null);

    try {
      const range = pageRangeMode === 'custom' ? customPageRange : 'all';
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        notes: customerNotes || null,
        files: [
          {
            original_name: uploadedFile.original_name,
            file_path: uploadedFile.file_path,
            file_size: uploadedFile.file_size,
            sha256_checksum: uploadedFile.sha256_checksum,
            page_count: uploadedFile.page_count,
          },
        ],
        items: [
          {
            file_index: 0,
            paper_size: paperSize,
            color_mode: colorMode,
            duplex_mode: duplexMode,
            copies,
            page_range: range,
          },
        ],
      };

      const res = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Order creation failed (${res.status})`);
      }

      const resData = await res.json();
      setCreatedOrder(resData.order);
      setPaymentSuccess(false);
      setPaymentError(null);

      // Load dynamic Soundbox UPI payload
      fetch(`/api/public/orders/${encodeURIComponent(resData.order.order_number)}/upi-qr`)
        .then(r => r.json())
        .then(d => { if (d.upi) setUpiData(d.upi); })
        .catch(console.error);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 5. Pay with Razorpay Test Mode
  const handlePayNow = async () => {
    if (!createdOrder) return;

    setPaying(true);
    setPaymentError(null);

    try {
      // Step A: Initiate Payment
      const initRes = await fetch(`/api/public/orders/${encodeURIComponent(createdOrder.order_number)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to initiate Razorpay payment.');
      }

      const initData = await initRes.json();
      const rzpOrderId = initData.razorpay.razorpay_order_id;
      const isMock = !initData.razorpay?.key_id || initData.razorpay.key_id.includes('mock');

      // If real Razorpay key is configured and Razorpay JS SDK is loaded, open official Razorpay Checkout
      if (!isMock && typeof (window as any).Razorpay !== 'undefined') {
        const options = {
          key: initData.razorpay.key_id,
          amount: initData.razorpay.amount,
          currency: initData.razorpay.currency || 'INR',
          name: branchData?.shop?.name || 'PrintEase',
          description: `Print Order #${createdOrder.order_number}`,
          order_id: rzpOrderId,
          handler: async function (response: any) {
            try {
              // Verify Payment on Backend
              const verifyRes = await fetch(`/api/public/orders/${encodeURIComponent(createdOrder.order_number)}/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              if (!verifyRes.ok) {
                const vErr = await verifyRes.json().catch(() => ({}));
                throw new Error(vErr.message || 'Payment verification rejected.');
              }

              const vData = await verifyRes.json();
              setPaymentSuccess(true);
              setCreatedOrder(vData.order);
            } catch (vErr: any) {
              setPaymentError(vErr.message || 'Payment verification failed.');
            } finally {
              setPaying(false);
            }
          },
          prefill: {
            name: createdOrder.customer_name,
            contact: createdOrder.customer_phone,
            email: createdOrder.customer_email || '',
          },
          theme: {
            color: '#4F46E5',
          },
          modal: {
            ondismiss: function () {
              setPaying(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return; // Wait for modal completion
      }

      // Fallback: Mock Test Mode Simulation
      const rzpPaymentId = `pay_test_${Math.floor(100000 + Math.random() * 900000)}`;

      // Calculate mock signature via Web Crypto API with test secret "mock_secret_key_67890"
      const encoder = new TextEncoder();
      const keyData = encoder.encode('mock_secret_key_67890');
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await window.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        encoder.encode(`${rzpOrderId}|${rzpPaymentId}`)
      );
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Verify Payment on Backend
      const verifyRes = await fetch(`/api/public/orders/${encodeURIComponent(createdOrder.order_number)}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPaymentId,
          razorpay_signature: signatureHex,
        }),
      });

      if (!verifyRes.ok) {
        const vErr = await verifyRes.json().catch(() => ({}));
        throw new Error(vErr.message || 'Payment verification rejected.');
      }

      const vData = await verifyRes.json();
      setPaymentSuccess(true);
      setCreatedOrder(vData.order);
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing failed.');
    } finally {
      setPaying(false);
    }
  };

  const copyOrderNumber = () => {
    if (createdOrder) {
      navigator.clipboard.writeText(createdOrder.order_number);
      setCopiedOrderNumber(true);
      setTimeout(() => setCopiedOrderNumber(false), 2000);
    }
  };

  // Poll order status to automatically catch Soundbox payments within 2.5 seconds
  useEffect(() => {
    if (!createdOrder || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED' || paymentSuccess) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/orders/${encodeURIComponent(createdOrder.order_number)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.order && (data.order.status === 'PRINT_QUEUED' || data.order.status === 'COMPLETED' || data.order.status === 'PRINTING')) {
            setPaymentSuccess(true);
            setCreatedOrder(data.order);
          }
        }
      } catch (err) {
        // ignore background poll errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [createdOrder, paymentSuccess]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step 1: Branch QR Resolution Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              QR
            </div>
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                Customer Self-Service Terminal
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Phase 4 Razorpay Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">Simulate customer scanning shop QR code</p>
            </div>
          </div>

          {onOpenPairingInfo && (
            <button
              onClick={onOpenPairingInfo}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Windows Agent Pairing Code
            </button>
          )}
        </div>

        {/* QR Selector input */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Active QR Code Token
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="e.g. pe_demo_connaught_branch_token_99"
              className="flex-1 text-sm px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <button
              onClick={() => resolveBranch(qrToken)}
              disabled={loadingBranch}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBranch ? 'animate-spin' : ''}`} />
              Verify QR
            </button>
          </div>

          {branchError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{branchError}</span>
            </div>
          )}

          {branchData && (
            <div className="mt-4 p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{branchData.shop.name}</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {branchData.branch.name}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {branchData.branch.address}, {branchData.branch.city} • Phone: {branchData.branch.phone || 'Available'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <Printer className="w-4 h-4" />
                <span>{branchData.printers.length} Printer(s) Online</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* If Order Placed: Success Screen with Razorpay Checkout */}
      {createdOrder ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            ) : (
              <CreditCard className="w-8 h-8" />
            )}
          </div>

          <div>
            <span className={`inline-block px-3 py-1 font-semibold text-xs rounded-full uppercase tracking-wider mb-2 ${
              paymentSuccess || createdOrder.status === 'PRINT_QUEUED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              Status: {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' ? 'PRINT_QUEUED' : createdOrder.status}
            </span>

            <h3 className="text-2xl font-black text-slate-900">
              {paymentSuccess || createdOrder.status === 'PRINT_QUEUED'
                ? 'Payment Successful & Job Queued!'
                : 'Order Created — Ready for Payment'}
            </h3>

            <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
              {paymentSuccess || createdOrder.status === 'PRINT_QUEUED'
                ? 'Your payment was verified via HMAC-SHA256. Print job is enqueued and ready for the paired Windows Desktop Agent!'
                : 'Your document is verified and stored securely. Complete payment to release the print job.'}
            </p>
          </div>

          {/* Order Details Receipt Box */}
          <div className="max-w-md mx-auto bg-slate-50 rounded-xl p-5 border border-slate-200 text-left space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Order Reference:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">{createdOrder.order_number}</span>
                <button
                  onClick={copyOrderNumber}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                  title="Copy Order Number"
                >
                  {copiedOrderNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Customer Name:</span>
              <span className="font-semibold text-slate-800">{createdOrder.customer_name}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Subtotal Amount:</span>
              <span className="font-semibold text-slate-800">₹{parseFloat(String(createdOrder.subtotal_amount)).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">GST (Tax 18%):</span>
              <span className="font-semibold text-slate-800">₹{parseFloat(String(createdOrder.tax_amount)).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-slate-200 text-indigo-900">
              <span>Total Payable:</span>
              <span>₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Actions */}
          {paymentError && (
            <div className="max-w-md mx-auto p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {!(paymentSuccess || createdOrder.status === 'PRINT_QUEUED') ? (
            <div className="max-w-md mx-auto space-y-4">
              {/* Payment Method Selector */}
              <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('soundbox')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'soundbox' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <span>🔊 Shop Soundbox / UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'razorpay' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <span>💳 Card / Gateway</span>
                </button>
              </div>

              {/* METHOD 1: Soundbox / Direct UPI QR */}
              {paymentMethod === 'soundbox' && (
                <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm text-center space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      {upiData?.soundbox_provider === 'phonepe' ? 'PhonePe Soundbox' : 'Paytm Soundbox'} Active
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Scan to Pay ₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Payee: <strong className="text-slate-700">{upiData?.merchant_name || 'Metro Print Solutions'}</strong> ({upiData?.merchant_vpa || 'metroprint@paytm'})
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div className="inline-block p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
                    {upiData?.qr_code_url ? (
                      <img
                        src={upiData.qr_code_url}
                        alt="UPI Payment QR Code"
                        className="w-44 h-44 mx-auto object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                        Generating Dynamic UPI QR...
                      </div>
                    )}
                  </div>

                  {/* Mobile 1-Tap App Deep Links */}
                  {upiData?.app_intents && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-slate-500">Or tap to open your UPI app on mobile:</p>
                      <div className="flex justify-center gap-2">
                        <a
                          href={upiData.app_intents.gpay}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors"
                        >
                          Google Pay
                        </a>
                        <a
                          href={upiData.app_intents.phonepe}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          PhonePe
                        </a>
                        <a
                          href={upiData.app_intents.paytm}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          Paytm
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Soundbox Notice Box */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left flex items-start gap-2">
                    <span className="text-base">🔊</span>
                    <div className="text-[11px] text-amber-900 leading-tight">
                      <strong>Auto-Print on Soundbox Voice:</strong> When your shop's Soundbox speaks <em>"₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)} prapt hue"</em>, your document prints automatically!
                    </div>
                  </div>

                  {/* Soundbox Real-Time Waiting Status */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Listening for Soundbox Voice Confirmation...</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      As soon as your payment arrives and the counter Soundbox announces <em>"₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)} prapt hue"</em>, your order will automatically be sent to the printer!
                    </p>
                  </div>

                  {/* Anti-Fraud Notice */}
                  <div className="text-[10px] text-slate-400 bg-slate-100 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Protected by PrintEase Soundbox Security. Print triggers only after verified bank credit.</span>
                  </div>
                </div>
              )}

              {/* METHOD 2: Razorpay Gateway */}
              {paymentMethod === 'razorpay' && (
                <div className="space-y-3">
                  <button
                    onClick={handlePayNow}
                    disabled={paying}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {paying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Pay via Cards / NetBanking / Razorpay</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Supports Debit/Credit Cards, NetBanking, and Gateway UPI.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-md mx-auto bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Print Job Released to Branch Spooler!</span>
              </div>
              <p className="text-xs text-slate-600">
                The desktop agent paired with this branch will poll this job via lease-lock, download the PDF, and send it to the Windows spooler.
              </p>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setCreatedOrder(null);
                setUploadedFile(null);
                setPaymentSuccess(false);
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Print Another Document
            </button>
          </div>
        </div>
      ) : (
        /* Order Creation Flow */
        <div className="space-y-6">
          {/* Step 2: PDF Upload Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Upload PDF Document</h3>
                <p className="text-xs text-slate-500">Upload your PDF file for automated page counting and printing</p>
              </div>
            </div>

            {!uploadedFile ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading || !branchData}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                  {uploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {uploading ? 'Analyzing PDF & Verifying Checksum...' : 'Click or Drag PDF here to upload'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Accepts standard PDF documents up to 50 MB</p>
              </label>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs sm:text-sm">{uploadedFile.original_name}</h4>
                    <p className="text-xs text-slate-500">
                      {(uploadedFile.file_size / (1024 * 1024)).toFixed(2)} MB •{' '}
                      <span className="font-bold text-indigo-600">{uploadedFile.page_count} page(s) detected</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Change File
                </button>
              </div>
            )}

            {uploadError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Step 3: Print Configuration */}
          {uploadedFile && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Print Configuration</h3>
                  <p className="text-xs text-slate-500">Customize color, sides, copies, and page ranges</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Color Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Color Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        colorMode === 'bw'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Black & White</div>
                      <div className="text-[11px] text-slate-500">Economical & Crisp</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        colorMode === 'color'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Full Color</div>
                      <div className="text-[11px] text-slate-500">Vibrant Quality</div>
                    </button>
                  </div>
                </div>

                {/* Duplex Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Print Sides (Duplex)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDuplexMode('single')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        duplexMode === 'single'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Single-Sided</div>
                      <div className="text-[11px] text-slate-500">1 side per sheet</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplexMode('duplex')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        duplexMode === 'duplex'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Double-Sided</div>
                      <div className="text-[11px] text-slate-500">2 sides per sheet</div>
                    </button>
                  </div>
                </div>

                {/* Paper Size */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="A4">A4 (Standard 210 × 297 mm)</option>
                    <option value="A3">A3 (Large 297 × 420 mm)</option>
                  </select>
                </div>

                {/* Copies */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Copies</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-700 text-base cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-base text-slate-900 w-8 text-center">{copies}</span>
                    <button
                      type="button"
                      onClick={() => setCopies((prev) => Math.min(50, prev + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-700 text-base cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Page Range Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700">Page Selection</label>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pageRangeMode"
                      checked={pageRangeMode === 'all'}
                      onChange={() => setPageRangeMode('all')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>All Pages ({uploadedFile.page_count} pages)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pageRangeMode"
                      checked={pageRangeMode === 'custom'}
                      onChange={() => setPageRangeMode('custom')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Custom Range</span>
                  </label>
                </div>

                {pageRangeMode === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customPageRange}
                      onChange={(e) => setCustomPageRange(e.target.value)}
                      placeholder="e.g. 1-3, 5, 7"
                      className="text-xs px-3.5 py-2 rounded-xl border border-slate-200 w-full max-w-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter comma-separated page numbers or ranges (e.g. "1-4" or "1, 3, 5-8").
                    </p>
                  </div>
                )}
              </div>

              {/* Live Cost Calculation Bar */}
              {estimate && (
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      ₹
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          Total Estimate: ₹{estimate.total_amount.toFixed(2)}
                        </span>
                        {calculating && <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Subtotal: ₹{estimate.subtotal.toFixed(2)} + GST (18%): ₹{estimate.tax_amount.toFixed(2)} • Sheets:{' '}
                        {estimate.items[0]?.total_sheets}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg self-start sm:self-center">
                    Instant Pricing Rule Applied
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Customer Details & Order Submit */}
          {uploadedFile && estimate && (
            <form onSubmit={handleSubmitOrder} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Customer Information</h3>
                  <p className="text-xs text-slate-500">Enter your details to track your print job and receive receipt</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Special Printing Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Staple top left, spiral binding, etc."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {orderError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Order & Locking Price...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Confirm Order & Proceed to Pay (₹{estimate.total_amount.toFixed(2)})</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
