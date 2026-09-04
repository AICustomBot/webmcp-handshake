'use client';

import { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  ThumbsUp,
  X,
} from 'lucide-react';
import type { Operation } from '@handshake/contracts';
import { useStudioStore } from '@/lib/store/studio-store';
import { resolveCatalogProduct } from './canvas-2d';

export function ProposalReviewModal() {
  const { activeProposal, setActiveProposal, decide, apply, isSyncing, error, catalog, roomState } =
    useStudioStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!activeProposal) return null;

  const proposal = activeProposal;
  const isApproved = proposal.status === 'approved';
  const isPending = proposal.status === 'pending_human';

  // Step 1: Human Consent Gate - Approve proposal (does NOT mutate room state yet)
  const handleApprove = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      const decided = await decide(proposal.id, proposal.hash, 'approved');
      if (!decided) {
        throw new Error('Approval decision failed to register with consensus authority');
      }
      // Updates proposal status to 'approved' in activeProposal
    } catch (err: any) {
      setLocalError(err.message || 'Failed to approve proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Apply approved proposal (authoritatively increments room version and updates items)
  const handleApply = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      await apply(proposal.id, proposal.hash, proposal.baseVersion);
      // Room version and state updated; clear overlay
      setActiveProposal(null);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to apply approved proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick action: Approve and immediately Apply in sequence
  const handleApproveAndApply = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      const decided = await decide(proposal.id, proposal.hash, 'approved');
      if (!decided) {
        throw new Error('Approval decision failed to register with consensus authority');
      }
      await apply(proposal.id, proposal.hash, proposal.baseVersion);
      setActiveProposal(null);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to apply approved proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 3: Reject proposal (leaves room version unmodified)
  const handleReject = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      await decide(proposal.id, proposal.hash, 'rejected');
      setActiveProposal(null);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to reject proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="proposal-review-modal"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-500/40 bg-[#0f172a] shadow-2xl text-slate-100">
        {/* Top Amber Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-inner">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    Agent Design Proposal Review
                  </h3>
                  <span
                    data-testid="proposal-status-badge"
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium capitalize ${
                      isApproved
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {proposal.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Constitutional Gate: Room state remains unmodified until human approval &amp;
                  apply
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveProposal(null)}
              className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Close review modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Proposal Cryptographic Telemetry */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
            <div>
              <span className="text-slate-500">Proposal ID</span>
              <div
                className="mt-0.5 font-mono text-slate-300 truncate"
                title={proposal.id}
                data-testid="proposal-id"
              >
                {proposal.id.slice(0, 12)}...
              </div>
            </div>
            <div>
              <span className="text-slate-500">Target Transition</span>
              <div
                className="mt-0.5 font-mono text-slate-300"
                data-testid="proposal-version-transition"
              >
                v{proposal.baseVersion} <ArrowRight className="inline h-3 w-3 text-slate-500" /> v
                {proposal.baseVersion + 1}
              </div>
            </div>
            <div>
              <span className="text-slate-500">SHA-256 Hash</span>
              <div
                className="mt-0.5 font-mono text-amber-300 truncate"
                title={proposal.hash}
                data-testid="proposal-hash"
              >
                {proposal.hash.slice(0, 10)}...
              </div>
            </div>
            <div>
              <span className="text-slate-500">Operations</span>
              <div
                className="mt-0.5 font-mono text-slate-300"
                data-testid="proposal-operations-count"
              >
                {proposal.operations.length} action{proposal.operations.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {/* Rationale */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Agent Architectural Rationale
            </span>
            <p
              className="mt-1.5 text-xs leading-relaxed text-slate-200"
              data-testid="proposal-rationale"
            >
              {proposal.rationale}
            </p>
          </div>

          {/* Itemized Operations Diff */}
          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Proposed Operations Diff ({proposal.operations.length})
            </span>
            <div
              className="mt-2 max-h-48 overflow-y-auto space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              data-testid="proposal-operations-diff"
            >
              {proposal.operations.map((op: Operation, idx: number) => {
                if (op.type === 'place') {
                  const prod = resolveCatalogProduct(op.productId, catalog);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs"
                      data-testid={`operation-diff-place-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                          PLACE
                        </span>
                        <span className="font-medium text-slate-200">{prod.name}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        ({op.x}&quot;, {op.y}&quot;) &bull; {op.rotation}&deg;
                      </div>
                    </div>
                  );
                }

                if (op.type === 'move') {
                  const existingItem = roomState?.items.find((i) => i.id === op.itemId);
                  const prod = existingItem
                    ? resolveCatalogProduct(existingItem.productId, catalog)
                    : null;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-blue-500/20 bg-blue-950/20 px-3 py-2 text-xs"
                      data-testid={`operation-diff-move-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                          MOVE
                        </span>
                        <span className="font-medium text-slate-200">
                          {prod ? prod.name : op.itemId}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        to ({op.x}&quot;, {op.y}&quot;)
                      </div>
                    </div>
                  );
                }

                if (op.type === 'remove') {
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-xs"
                      data-testid={`operation-diff-remove-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-300">
                          REMOVE
                        </span>
                        <span className="font-mono text-slate-200">{op.itemId}</span>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          {/* Error Message */}
          {(localError || error) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{localError || error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Zero autonomous state mutation guarantee</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Reject Button */}
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessing || isSyncing}
                data-testid="reject-proposal-button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 text-slate-400" />
                <span>Reject</span>
              </button>

              {/* Approve Button (records human approval decision) */}
              {isPending && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessing || isSyncing}
                  data-testid="approve-proposal-button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4" />
                  )}
                  <span>Approve</span>
                </button>
              )}

              {/* Apply Button (commits approved changes into room state) */}
              {isApproved && (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isProcessing || isSyncing}
                  data-testid="apply-proposal-button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-white" />
                  )}
                  <span>Apply to Design (v{proposal.baseVersion + 1})</span>
                </button>
              )}

              {/* Convenient Combined Approve & Apply Button */}
              {isPending && (
                <button
                  type="button"
                  onClick={handleApproveAndApply}
                  disabled={isProcessing || isSyncing}
                  data-testid="approve-and-apply-proposal-button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Approve &amp; Apply</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
