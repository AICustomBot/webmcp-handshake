'use client';

import { useState } from 'react';
import { ShieldAlert, CheckCircle2, Lock, Key, Loader2, Calendar, FileText } from 'lucide-react';
import type { ProtectedAction, ProtectedActionResponse } from '@handshake/contracts';

export interface ProtectedActionCardProps {
  action: ProtectedAction;
  payload: Record<string, string>;
  onConfirm: (
    action: ProtectedAction,
    payload: Record<string, string>,
  ) => Promise<ProtectedActionResponse | null>;
  isSyncing?: boolean;
}

export function ProtectedActionCard({
  action,
  payload,
  onConfirm,
  isSyncing = false,
}: ProtectedActionCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedResponse, setConfirmedResponse] = useState<ProtectedActionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);
    try {
      const res = await onConfirm(action, payload);
      if (res) {
        setConfirmedResponse(res);
      } else {
        setError('Confirmation declined or execution failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute protected action.');
    } finally {
      setIsConfirming(false);
    }
  };

  const actionLabel =
    action === 'book_consultation' ? 'Showroom Design Consultation' : 'Custom Fixture Quote';

  return (
    <div
      data-testid="protected-action-card"
      className="my-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 shadow-lg backdrop-blur-sm transition-all"
    >
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300">
            {action === 'book_consultation' ? (
              <Calendar className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-indigo-200">
              Protected Synthetic Action
            </span>
            <span className="ml-2 font-mono text-[11px] text-slate-400">{action}</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
          <Lock className="h-3 w-3" />
          Consent Gate
        </span>
      </div>

      <div className="mt-2.5 text-xs text-slate-300">
        <p className="font-medium text-white">{actionLabel}</p>
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-xs font-mono text-slate-300 space-y-1">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-slate-500">{k}:</span>
              <span className="text-slate-200">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] text-indigo-300">
        <ShieldAlert className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
        <span>
          Under Handshake governance, AI agents cannot trigger external actions directly. Single-use
          human proof token is required.
        </span>
      </div>

      {error && (
        <div className="mt-2.5 rounded bg-rose-950/50 p-2 text-xs text-rose-300 border border-rose-500/30">
          {error}
        </div>
      )}

      <div className="mt-3.5 pt-2.5 border-t border-indigo-500/20">
        {confirmedResponse ? (
          <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              Action confirmed &amp; recorded with receipt proof #
              {confirmedResponse.reference.slice(0, 8)}...
            </span>
          </div>
        ) : (
          <button
            type="button"
            data-testid="confirm-protected-action-btn"
            onClick={handleConfirm}
            disabled={isConfirming || isSyncing}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {isConfirming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Key className="h-3.5 w-3.5" />
            )}
            <span>Generate Proof &amp; Confirm Action</span>
          </button>
        )}
      </div>
    </div>
  );
}
