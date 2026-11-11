import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Key, Check } from 'lucide-react';

interface Props {
  onSuccess: (data: { token: string; user: any; shops?: any[] }) => void;
  onError?: (error: string) => void;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
  roleHint?: 'shop_owner' | 'super_admin';
}

declare global {
  interface Window {
    google?: any;
    __googleGsiLoaded?: boolean;
  }
}

export const GoogleSignInButton: React.FC<Props> = ({
  onSuccess,
  onError,
  buttonText = 'continue_with',
  roleHint = 'shop_owner',
}) => {
  const btnContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customClientId, setCustomClientId] = useState('');

  // 1. Resolve Google Client ID from Vite env or LocalStorage
  const getClientId = () => {
    return (
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('printease_google_client_id') ||
      ''
    );
  };

  const [activeClientId, setActiveClientId] = useState<string>(getClientId());

  // 2. Load Google Identity Services script
  useEffect(() => {
    if (window.google?.accounts?.id) {
      initGoogleButton();
      return;
    }

    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.__googleGsiLoaded = true;
        initGoogleButton();
      };
      document.body.appendChild(script);
    } else {
      script.addEventListener('load', initGoogleButton);
    }

    return () => {
      if (script) script.removeEventListener('load', initGoogleButton);
    };
  }, [activeClientId]);

  // 3. Initialize Google Sign-In Button
  const initGoogleButton = () => {
    if (!window.google?.accounts?.id || !btnContainerRef.current) return;

    if (!activeClientId) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: activeClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear existing children
      btnContainerRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(btnContainerRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: buttonText,
        shape: 'rectangular',
        logo_alignment: 'left',
        width: btnContainerRef.current.offsetWidth || 340,
      });
    } catch (err: any) {
      console.error('[GoogleAuth] Failed to initialize button:', err);
    }
  };

  // 4. Handle Google ID Token response
  const handleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      setErrorMsg('No credential received from Google.');
      onError?.('No credential received from Google.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ credential: response.credential, role_hint: roleHint }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Google authentication failed.');
      }

      onSuccess(data);
    } catch (err: any) {
      const msg = err.message || 'Error communicating with server.';
      setErrorMsg(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customClientId.trim();
    if (!trimmed) return;
    localStorage.setItem('printease_google_client_id', trimmed);
    setActiveClientId(trimmed);
    setShowConfigModal(false);
  };

  return (
    <div className="w-full space-y-3">
      {/* Error message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Google GSI Container or Setup prompt */}
      {activeClientId ? (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div ref={btnContainerRef} className="w-full flex justify-center min-h-[44px]" />
        </div>
      ) : (
        /* Fallback when Client ID is not configured yet */
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="w-full py-3 px-4 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <p className="text-[10px] text-center text-slate-400">
            Click to configure Google OAuth Client ID for this domain
          </p>
        </div>
      )}

      {/* Configure Google Client ID Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Google OAuth Client ID</h3>
                <p className="text-xs text-slate-500">Enable Google Sign-In for PrintEase</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Google Cloud Console se apna <strong>Web Client ID</strong> paste karein. Yeh browser mein save ho jayega aur Railway environment variable <code>VITE_GOOGLE_CLIENT_ID</code> se bhi load hota hai.
            </p>

            <form onSubmit={handleSaveCustomClientId} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Client ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save & Enable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
