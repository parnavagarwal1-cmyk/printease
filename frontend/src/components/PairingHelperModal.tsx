import React, { useState } from 'react';
import { X, Copy, Check, Key, Terminal } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PairingHelperModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const demoCode = 'PRNT-8821-X9';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Key className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Desktop Agent Pairing Code</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Active Pre-seeded Code Card */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Ready-to-Use Demo Pairing Code
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className="font-mono text-2xl font-black text-indigo-950 tracking-wider">
                {demoCode}
              </span>
              <button
                onClick={() => copyToClipboard(demoCode)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copiedCode === demoCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-indigo-800/80 mt-2">
              Pre-seeded in your local database for Branch 1 (Connaught Place Main Branch).
            </p>
          </div>

          {/* How to use */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              How Pairing Works:
            </h4>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center shrink-0">
                  1
                </div>
                <p>
                  Open the <strong>PrintEase Desktop App</strong> (Electron window) and go to the <strong>Pairing & Security</strong> tab.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center shrink-0">
                  2
                </div>
                <p>
                  Paste <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono font-bold">PRNT-8821-X9</code> into the Pairing Code field and click <strong>Pair Device</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center shrink-0">
                  3
                </div>
                <p>
                  The desktop agent securely exchanges this code with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">POST /api/desktop/pair</code>, receives a long-lived device token (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">dtk_...</code>), invalidates the one-time code, and starts heartbeat polling!
                </p>
              </div>
            </div>
          </div>

          {/* How to generate fresh code */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              Generating Fresh Codes via API:
            </h4>
            <p className="text-xs text-slate-500 mb-2">
              In production, the shop owner clicks "Generate Pairing Code" on their branch dashboard:
            </p>
            <pre className="text-[11px] bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono overflow-x-auto">
POST /api/branches/1/pairing-code{'\n'}
Authorization: Bearer &lt;shop_owner_token&gt;
            </pre>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
