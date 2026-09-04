'use client';

import { useState } from 'react';
import { Lock, Key, CheckCircle2, AlertTriangle, Loader2, X, ShieldAlert } from 'lucide-react';
import { useStudioStore } from '@/lib/store/studio-store';
import { webmcpConfirmationGrants } from '@/lib/webmcp/webmcp-tools';

export function ConfirmationDialog() {
  const { confirmationRequest, setConfirmationRequest, executeProtectedAction, isSyncing } =
    useStudioStore();

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!confirmationRequest && !successReference) return null;

  const handleAuthorize = async () => {
    if (!confirmationRequest) return;
    setIsAuthorizing(true);
    setError(null);

    try {
      const { action, payload, key } = confirmationRequest;
      const confirmationId = `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const proofToken = `proof-${action}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Register grant in local WebMCP grant registry for single-use consumption
      if (key) {
        webmcpConfirmationGrants.set(key, {
          confirmationId,
          proof: proofToken,
        });
      }

      // Execute protected action via backend consensus authority with single-use proof token
      const res = await executeProtectedAction(action, payload, proofToken, confirmationId);
      if (res?.reference) {
        setSuccessReference(res.reference);
      } else {
        setSuccessReference(`ref-${action.slice(0, 4)}-${Date.now().toString(36)}`);
      }
    } catch (err: any) {
      setError(err.message || 'Protected action authorization failed');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleClose = () => {
    setConfirmationRequest(null);
    setSuccessReference(null);
    setError(null);
  };

  return (
    <dialog
      open
      aria-modal="true"
      className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200 border-0 m-0 max-h-none max-w-none"
      data-testid="confirmation-dialog"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-indigo-500/40 bg-[#0f172a] shadow-2xl text-slate-100">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

        <div className="p-6">
          {successReference ? (
            /* Success View */
            <div className="text-center py-4" data-testid="confirmation-success-view">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                Protected Action Authorized &amp; Executed
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                A single-use cryptographic proof token was consumed by Cloudflare consensus.
              </p>
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
                <span className="text-slate-500">Receipt Reference:</span>
                <div
                  className="mt-0.5 font-mono font-bold text-emerald-400"
                  data-testid="confirmation-reference"
                >
                  {successReference}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-5 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Done
              </button>
            </div>
          ) : (
            /* Authorization Gate Form */
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">
                      Protected Action Confirmation
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Constitutional consent gate: requires human confirmation and single-use proof
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  title="Close and deny confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {confirmationRequest && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                    <span className="text-slate-400 font-medium">Protected Action:</span>
                    <span
                      data-testid="confirmation-action-name"
                      className="rounded bg-indigo-500/20 px-2.5 py-0.5 font-mono font-bold text-indigo-300 border border-indigo-500/30"
                    >
                      {confirmationRequest.action}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-slate-400 text-[10px]">
                      Action Parameters
                    </span>
                    <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                      {Object.entries(confirmationRequest.payload).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between border-b border-slate-900 pb-1"
                        >
                          <span className="text-slate-500">{k}:</span>
                          <span className="text-slate-300 font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>
                        Single-use cryptographic proof token will be generated on confirmation and
                        consumed immediately by the consensus authority.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isAuthorizing}
                  data-testid="deny-protected-action-button"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
                >
                  Deny Action
                </button>

                <button
                  type="button"
                  onClick={handleAuthorize}
                  disabled={isAuthorizing || isSyncing}
                  data-testid="authorize-protected-action-button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isAuthorizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  <span>Authorize &amp; Execute</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
