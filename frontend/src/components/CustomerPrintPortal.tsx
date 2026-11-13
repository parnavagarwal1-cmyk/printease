import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Image as ImageIcon,
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  CreditCard, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  Store, 
  MapPin, 
  Layers, 
  Palette, 
  Volume2, 
  ArrowRight, 
  RotateCcw 
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
  defaultQrToken = 'default'
}) => {
  const [qrToken, setQrToken] = useState<string>(defaultQrToken || 'default');
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
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
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

  // 1. Resolve Branch Details automatically from QR Token
  const resolveBranch = useCallback(async (token: string) => {
    setLoadingBranch(true);
    setBranchError(null);
    try {
      const cleanToken = token.trim() || 'default';
      const res = await fetch(`/api/public/qr/${encodeURIComponent(cleanToken)}`);
      if (!res.ok) {
        throw new Error(`Unable to load counter details (${res.status}). Please scan the counter QR again.`);
      }
      const data: QrResolutionResponse = await res.json();
      setBranchData(data);
      if (data.qr_token && data.qr_token !== qrToken) {
        setQrToken(data.qr_token);
      }
      const defaultSize = data.branch?.default_paper_size || 'A4';
      const activeRules = (data.pricing_rules || []).filter((r: any) => r.is_active !== false);
      if (activeRules.some((r: any) => r.paper_size.toUpperCase() === defaultSize.toUpperCase())) {
        setPaperSize(defaultSize.toUpperCase());
      } else if (activeRules.length > 0) {
        setPaperSize(activeRules[0].paper_size.toUpperCase());
      } else {
        setPaperSize('A4');
      }
    } catch (err: any) {
      setBranchError(err.message || 'Failed to scan shop QR code.');
      setBranchData(null);
    } finally {
      setLoadingBranch(false);
    }
  }, [qrToken]);

  useEffect(() => {
    if (defaultQrToken && defaultQrToken !== qrToken) {
      setQrToken(defaultQrToken);
    }
  }, [defaultQrToken]);

  useEffect(() => {
    resolveBranch(qrToken);
  }, [qrToken, resolveBranch]);

  // Pricing helper for selected paper size
  const currentPricingRule = branchData?.pricing_rules?.find(
    (r: any) => r.paper_size.toUpperCase() === paperSize.toUpperCase() && r.is_active !== false
  );
  const bwPriceDisplay = currentPricingRule ? `₹${parseFloat(String(currentPricingRule.bw_single_price)).toFixed(2)}` : '₹2.00';
  const colorPriceDisplay = currentPricingRule ? `₹${parseFloat(String(currentPricingRule.color_single_price)).toFixed(2)}` : '₹10.00';

  // 2. Handle File Upload (PDF, JPG, PNG, DOCX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(fileName);
    const isDocx = file.type.includes('word') || /\.(docx|doc)$/i.test(fileName);

    if (!isPdf && !isImage && !isDocx) {
      setUploadError('Please select a supported file format: PDF, JPG, PNG, or Word (DOCX).');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const activeToken = branchData?.qr_token || qrToken || 'default';
      const res = await fetch(`/api/public/qr/${encodeURIComponent(activeToken)}/upload`, {
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
      setUploadError(err.message || 'Error uploading file. Please try again.');
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
        const activeToken = branchData.qr_token || qrToken || 'default';
        const res = await fetch(`/api/public/qr/${encodeURIComponent(activeToken)}/estimate`, {
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
        customer_name: customerName.trim() || 'Counter Customer',
        customer_phone: customerPhone.trim() || '9876543210',
        customer_email: null,
        notes: customerNotes.trim() || null,
        files: [
          {
            original_name: uploadedFile.original_name,
            file_path: uploadedFile.file_path,
            file_size: uploadedFile.file_size,
            sha256_checksum: uploadedFile.sha256_checksum,
            page_count: uploadedFile.page_count,
            mime_type: uploadedFile.mime_type,
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

      const activeToken = branchData.qr_token || qrToken || 'default';
      const res = await fetch(`/api/public/qr/${encodeURIComponent(activeToken)}/orders`, {
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
        .then(d => {
          if (d.upi) {
            setUpiData(d.upi);
            if (d.upi.razorpay_enabled) {
              setPaymentMethod('razorpay');
            }
          }
        })
        .catch(console.error);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 5. Pay with Razorpay
  const handlePayNow = async () => {
    if (!createdOrder) return;

    setPaying(true);
    setPaymentError(null);

    try {
      const initRes = await fetch(`/api/public/orders/${encodeURIComponent(createdOrder.order_number)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to initiate payment.');
      }

      const initData = await initRes.json();
      const rzpOrderId = initData.razorpay?.razorpay_order_id;
      const keyId = initData.razorpay?.key_id;
      const isMock = Boolean(initData.razorpay?.is_mock) || !keyId || keyId.includes('mock');

      if (!isMock && rzpOrderId && typeof (window as any).Razorpay !== 'undefined') {
        const options = {
          key: keyId,
          amount: initData.razorpay.amount,
          currency: initData.razorpay.currency || 'INR',
          name: branchData?.shop?.name || 'PrintEase',
          description: `Print Order #${createdOrder.order_number}`,
          order_id: rzpOrderId,
          handler: async function (response: any) {
            try {
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
        rzp.on('payment.failed', function (resp: any) {
          setPaying(false);
          const failMsg = resp.error?.description || resp.error?.reason || 'Payment failed.';
          setPaymentError(`Payment failed: ${failMsg}`);
        });
        rzp.open();
        return;
      }

      if (isMock) {
        throw new Error('Razorpay gateway is not configured with active merchant credentials yet. Please pay using the Shop Soundbox / UPI QR above.');
      }

      throw new Error('Online gateway is currently unavailable. Please scan the Shop Soundbox / UPI QR above to pay directly.');
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

  // Poll order status to automatically catch Soundbox payments
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
        // background poll quiet
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [createdOrder, paymentSuccess]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Shop Identity Card (Clean, modern counter branding) */}
      {loadingBranch ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-200"></div>
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3.5 bg-slate-100 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ) : branchError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-rose-900 text-base">{branchError}</h3>
          <p className="text-xs text-rose-600 max-w-sm mx-auto">
            Please make sure you scanned the official QR code at the shop counter, or ask the store operator.
          </p>
          <button
            onClick={() => resolveBranch(qrToken)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      ) : branchData && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Store className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {branchData.shop.name}
                  </h1>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Instant Counter Print
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                  <span>{branchData.branch.name}</span>
                  {branchData.branch.city && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {branchData.branch.city}
                      </span>
                    </>
                  )}
                  {branchData.branch.phone && (
                    <>
                      <span>•</span>
                      <span>{branchData.branch.phone}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200/70 px-3.5 py-1.5 rounded-xl self-start sm:self-center">
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>{branchData.printers.length} Printer Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Flow: Only render once branch is verified */}
      {branchData && (createdOrder ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center shadow-inner">
            {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            ) : (
              <CreditCard className="w-8 h-8 text-indigo-600" />
            )}
          </div>

          <div>
            <span className={`inline-block px-3 py-1 font-bold text-[11px] rounded-full uppercase tracking-wider mb-2 ${
              paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED'
                ? '✓ ORDER SENT TO PRINTER'
                : 'AWAITING PAYMENT'}
            </span>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED'
                ? 'Your Document is Printing!'
                : 'Complete Payment to Release Print'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              {paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED'
                ? 'Payment confirmed! The counter printer has received your job and is spooling pages now. Collect your prints from the counter.'
                : 'Scan the UPI QR code below with any payment app. Your document will start printing instantly once the Soundbox confirms.'}
            </p>
          </div>

          {/* Receipt Breakdown Card */}
          <div className="max-w-md mx-auto bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-left space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">Order Token:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900 text-sm">{createdOrder.order_number}</span>
                <button
                  onClick={copyOrderNumber}
                  className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-500 transition-colors cursor-pointer"
                  title="Copy Order Number"
                >
                  {copiedOrderNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Customer:</span>
              <span className="font-semibold text-slate-800">{createdOrder.customer_name}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Document:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                {uploadedFile?.original_name || 'Uploaded Document'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Print Setup:</span>
              <span className="font-semibold text-slate-800 uppercase">
                {paperSize} • {colorMode === 'bw' ? 'B&W' : 'Color'} • {duplexMode === 'duplex' ? 'Double-Sided' : 'Single-Sided'} ({copies} {copies > 1 ? 'copies' : 'copy'})
              </span>
            </div>

            <div className="flex justify-between items-center text-sm font-black pt-2.5 border-t border-slate-200/80 text-indigo-950">
              <span>Total Paid:</span>
              <span className="text-base text-emerald-700">₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Section */}
          {paymentError && (
            <div className="max-w-md mx-auto p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {!(paymentSuccess || createdOrder.status === 'PRINT_QUEUED' || createdOrder.status === 'COMPLETED') ? (
            <div className="max-w-md mx-auto space-y-4">
              {/* Payment Method Selector */}
              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('soundbox')}
                  className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'soundbox' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Shop Soundbox / UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'razorpay' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Online / Razorpay</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full ml-1">
                    ⚡ Auto-Print
                  </span>
                </button>
              </div>

              {/* METHOD 1: Shop Soundbox / Dynamic UPI QR */}
              {paymentMethod === 'soundbox' && (
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 shadow-xs text-center space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      {upiData?.soundbox_provider === 'phonepe'
                        ? 'PhonePe SmartSpeaker'
                        : upiData?.soundbox_provider === 'gpay'
                        ? 'Google Pay Soundbox'
                        : upiData?.soundbox_provider === 'direct_upi'
                        ? 'Direct Counter UPI'
                        : 'Paytm Soundbox'} Connected
                    </span>
                    <h3 className="text-xl font-black text-slate-900">
                      Scan to Pay ₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Payee: <strong className="text-slate-700">{upiData?.merchant_name || branchData?.shop?.name || 'Shop Counter'}</strong>{' '}
                      {upiData?.merchant_vpa && (
                        <span className="font-mono bg-slate-100 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {upiData.merchant_vpa}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* QR Image Container */}
                  <div className="inline-block p-3.5 bg-white rounded-3xl border-2 border-slate-200 shadow-inner">
                    {upiData?.qr_code_url ? (
                      <img
                        src={upiData.qr_code_url}
                        alt="UPI Payment QR Code"
                        className="w-48 h-48 mx-auto object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                        Generating Dynamic UPI QR...
                      </div>
                    )}
                  </div>

                  {/* 1-Tap UPI Mobile Deep Links */}
                  {upiData?.app_intents && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500">Or tap to open UPI app:</p>
                      <div className="flex justify-center gap-2 flex-wrap">
                        <a
                          href={upiData.app_intents.gpay}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                        >
                          Google Pay
                        </a>
                        <a
                          href={upiData.app_intents.phonepe}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          PhonePe
                        </a>
                        <a
                          href={upiData.app_intents.paytm}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          Paytm
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Soundbox Real-Time Waiting Status */}
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 text-indigo-800 font-bold text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Listening for Soundbox Voice Confirmation...</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      As soon as the counter Soundbox announces payment received, your document prints immediately!
                    </p>
                  </div>
                </div>
              )}

              {/* METHOD 2: Razorpay Gateway */}
              {paymentMethod === 'razorpay' && (
                <div className="space-y-3">
                  <button
                    onClick={handlePayNow}
                    disabled={paying}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {paying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Payment...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Pay ₹{parseFloat(String(createdOrder.total_amount)).toFixed(2)} Online</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Supports Debit/Credit Cards, NetBanking, and Wallets.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-md mx-auto bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Job Queued to Counter Spooler!</span>
              </div>
              <p className="text-xs text-slate-600">
                The paired Windows Desktop Agent has received this print request and is processing it right now.
              </p>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                setCreatedOrder(null);
                setUploadedFile(null);
                setPaymentSuccess(false);
              }}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-2xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Print Another Document
            </button>
          </div>
        </div>
      ) : (
        /* Order Creation Flow: Step 1 (Upload) -> Step 2 (Settings) -> Step 3 (Pay) */
        <div className="space-y-6">
          {/* STEP 1: Upload Document Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
            <div className="flex items-center space-x-3.5 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shadow-indigo-600/20">
                1
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Select Document or Photo</h2>
                <p className="text-xs text-slate-500">Upload PDF, JPG, PNG, or Word (DOCX) for instant pricing</p>
              </div>
            </div>

            {!uploadedFile ? (
              <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/40 transition-all text-center group">
                <input
                  type="file"
                  accept=".pdf,application/pdf,.jpg,.jpeg,image/jpeg,.png,image/png,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword"
                  onChange={handleFileUpload}
                  disabled={uploading || !branchData}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                  {uploading ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  {uploading ? 'Analyzing Document & Counting Pages...' : 'Tap to Choose Document or Photo'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Upload file for instant automated page detection & pricing
                </p>

                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5">
                  <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-bold">
                    📄 PDF
                  </span>
                  <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-[10px] font-bold">
                    🖼️ JPG / PNG
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-[10px] font-bold">
                    📝 Word DOCX
                  </span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px]">
                    Max 50 MB
                  </span>
                </div>
              </label>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5 overflow-hidden">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    /\.(jpg|jpeg|png)$/i.test(uploadedFile.original_name)
                      ? 'bg-sky-100 text-sky-600'
                      : /\.(docx|doc)$/i.test(uploadedFile.original_name)
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-rose-100 text-rose-600'
                  }`}>
                    {/\.(jpg|jpeg|png)$/i.test(uploadedFile.original_name) ? (
                      <ImageIcon className="w-6 h-6" />
                    ) : (
                      <FileText className="w-6 h-6" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{uploadedFile.original_name}</h4>
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        /\.(jpg|jpeg|png)$/i.test(uploadedFile.original_name)
                          ? 'bg-sky-100 text-sky-700'
                          : /\.(docx|doc)$/i.test(uploadedFile.original_name)
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {/\.(jpg|jpeg|png)$/i.test(uploadedFile.original_name) ? 'Photo' : /\.(docx|doc)$/i.test(uploadedFile.original_name) ? 'DOCX' : 'PDF'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{(uploadedFile.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md text-[11px]">
                        ✓ {uploadedFile.page_count} Page{uploadedFile.page_count > 1 ? 's' : ''} Detected
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-white bg-slate-100 transition-colors shrink-0 cursor-pointer"
                >
                  Change File
                </button>
              </div>
            )}

            {uploadError && (
              <div className="mt-3.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* STEP 2: Print Configuration (Interactive Visual Cards) */}
          {uploadedFile && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7 space-y-6">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shadow-indigo-600/20">
                  2
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Print Configuration</h2>
                  <p className="text-xs text-slate-500">Choose your color, sides, copies, and paper preferences</p>
                </div>
              </div>

              {/* Setting Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Color Mode Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Color Mode</span>
                    <span className="text-[11px] text-slate-400 font-normal">Select appearance</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* B&W Card */}
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        colorMode === 'bw'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 text-indigo-950'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                          B/W
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-md">
                          {bwPriceDisplay}
                        </span>
                      </div>
                      <div className="text-xs font-bold">Black & White</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Crisp monochrome</div>
                    </button>

                    {/* Color Card */}
                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        colorMode === 'color'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 text-indigo-950'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500 text-white flex items-center justify-center">
                          <Palette className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-md">
                          {colorPriceDisplay}
                        </span>
                      </div>
                      <div className="text-xs font-bold">Full Color</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Vibrant quality</div>
                    </button>
                  </div>
                </div>

                {/* 2. Duplex Mode Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Print Sides</span>
                    <span className="text-[11px] text-slate-400 font-normal">Single or duplex</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Single Sided */}
                    <button
                      type="button"
                      onClick={() => setDuplexMode('single')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        duplexMode === 'single'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 text-indigo-950'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-xs font-bold">Single-Sided</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">1 page per sheet</div>
                    </button>

                    {/* Double Sided */}
                    <button
                      type="button"
                      onClick={() => setDuplexMode('duplex')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        duplexMode === 'duplex'
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 text-indigo-950'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-xs font-bold">Double-Sided</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Prints both sides</div>
                    </button>
                  </div>
                </div>

                {/* 3. Paper Size Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-3 rounded-2xl border border-slate-200/90 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {(branchData?.pricing_rules || []).filter((r) => r.is_active !== false).length > 0 ? (
                      (branchData?.pricing_rules || [])
                        .filter((r) => r.is_active !== false)
                        .map((r) => (
                          <option key={r.paper_size} value={r.paper_size.toUpperCase()}>
                            {r.paper_size.toUpperCase()} {r.paper_size.toUpperCase() === 'A4' ? '(Standard 210 × 297 mm)' : r.paper_size.toUpperCase() === 'A3' ? '(Large Poster 297 × 420 mm)' : ''}
                          </option>
                        ))
                    ) : (
                      <option value="A4">A4 (Standard 210 × 297 mm)</option>
                    )}
                  </select>
                </div>

                {/* 4. Copies Counter Stepper */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Copies Required</label>
                  <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5">
                    <button
                      type="button"
                      onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center font-black text-slate-700 text-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-black text-base text-slate-900 flex-1 text-center font-mono">
                      {copies} {copies > 1 ? 'sets' : 'set'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies((prev) => Math.min(50, prev + 1))}
                      className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center font-black text-slate-700 text-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Page Range Selection */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">Pages to Print</label>
                <div className="flex gap-5 items-center flex-wrap">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pageRangeMode"
                      checked={pageRangeMode === 'all'}
                      onChange={() => setPageRangeMode('all')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>All Pages (All {uploadedFile.page_count} pages)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pageRangeMode"
                      checked={pageRangeMode === 'custom'}
                      onChange={() => setPageRangeMode('custom')}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>Specific Pages (Custom range)</span>
                  </label>
                </div>

                {pageRangeMode === 'custom' && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={customPageRange}
                      onChange={(e) => setCustomPageRange(e.target.value)}
                      placeholder="e.g. 1-3, 5, 7"
                      className="text-xs px-4 py-2.5 rounded-2xl border border-slate-200/90 w-full max-w-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter comma-separated page numbers or ranges (e.g. "1-4" or "1, 3, 5-8").
                    </p>
                  </div>
                )}
              </div>

              {/* Live Cost Estimation Bar */}
              {estimate && (
                <div className="bg-gradient-to-r from-indigo-50 to-indigo-50/40 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                        Estimated Amount
                      </span>
                      {calculating && <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">
                        ₹{estimate.total_amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">
                        (₹{estimate.subtotal.toFixed(2)} + GST ₹{estimate.tax_amount.toFixed(2)})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Total Sheets: {estimate.items[0]?.total_sheets || 1} • Impressions: {(estimate.items[0]?.effective_page_count || 1) * copies}
                    </p>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 bg-white border border-indigo-200/80 text-indigo-700 rounded-xl self-start sm:self-center shadow-2xs">
                    Shop Rates Applied
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Customer Information & Proceed to Pay Form */}
          {uploadedFile && estimate && (
            <form onSubmit={handleSubmitOrder} className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-7 space-y-5">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shadow-indigo-600/20">
                  3
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">Customer Details</h2>
                  <p className="text-xs text-slate-500">Provide your name so the shop operator can hand you your prints</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-3 rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-3 rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Special Note for Shopkeeper (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Corner staple, spiral binding, keep ready by 5 PM"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full text-xs font-medium px-4 py-3 rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {orderError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{orderError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Order & Locking Price...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Pay ₹{estimate.total_amount.toFixed(2)} & Print</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
};
