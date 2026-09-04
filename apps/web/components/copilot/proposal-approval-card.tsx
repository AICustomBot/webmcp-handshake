'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Hash,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { Proposal, Operation } from '@handshake/contracts';

export interface ProposalApprovalCardProps {
  proposal: Proposal;
  onApprove: (proposal: Proposal) => Promise<void>;
  onReject: (proposal: Proposal) => Promise<void>;
  onApply: (proposal: Proposal) => Promise<void>;
  isSyncing?: boolean;
}

export function ProposalApprovalCard({
  proposal,
  onApprove,
  onReject,
  onApply,
  isSyncing = false,
}: ProposalApprovalCardProps) {
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await onApprove(proposal);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve proposal');
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await onReject(proposal);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject proposal');
    } finally {
      setIsActing(false);
    }
  };

  const handleApply = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      await onApply(proposal);
    } catch (err: any) {
      setActionError(err.message || 'Failed to apply proposal');
    } finally {
      setIsActing(false);
    }
  };

  const isPending = proposal.status === 'pending_human';
  const isApproved = proposal.status === 'approved';
  const isApplied = proposal.status === 'applied';
  const isRejected = proposal.status === 'rejected';

  return (
    <div
      data-testid="proposal-approval-card"
      className="my-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-lg backdrop-blur-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-amber-200">
              Proposed Architectural Change
            </span>
            <span className="ml-2 font-mono text-[11px] text-slate-400">
              #{proposal.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1.5">
          {isPending && (
            <span
              data-testid="proposal-status-pending"
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
            >
              <Clock className="h-3 w-3" />
              Pending Review
            </span>
          )}
          {isApproved && (
            <span
              data-testid="proposal-status-approved"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3" />
              Approved
            </span>
          )}
          {isApplied && (
            <span
              data-testid="proposal-status-applied"
              className="inline-flex items-center gap-1 rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300"
            >
              <ShieldCheck className="h-3 w-3" />
              Committed (v{proposal.appliedVersion ?? proposal.baseVersion + 1})
            </span>
          )}
          {isRejected && (
            <span
              data-testid="proposal-status-rejected"
              className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300"
            >
              <XCircle className="h-3 w-3" />
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Rationale */}
      <div className="mt-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs text-slate-200">
        <span className="font-semibold text-slate-400">Rationale: </span>
        <span>{proposal.rationale}</span>
      </div>

      {/* Operations List (Diff) */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-amber-400" />
            Operations ({proposal.operations.length})
          </span>
          <span className="font-mono">Base: v{proposal.baseVersion}</span>
        </div>
        <div className="space-y-1.5">
          {proposal.operations.map((op: Operation, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    op.type === 'place'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : op.type === 'move'
                        ? 'bg-blue-500/20 text-blue-300'
                        : op.type === 'remove'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-indigo-500/20 text-indigo-300'
                  }`}
                >
                  {op.type}
                </span>
                <span className="text-white">
                  {op.type === 'place' ? op.productId : 'itemId' in op ? op.itemId : op.type}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {'x' in op && 'y' in op && (
                  <span>
                    ({op.x}&quot;, {op.y}&quot;)
                    {'rotation' in op && ` @ ${op.rotation}°`}
                  </span>
                )}
                {op.type === 'swap' && <span>→ {op.replacementProductId}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proposal Cryptographic Hash */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1 font-mono">
          <Hash className="h-3 w-3 text-slate-400" />
          SHA-256: {proposal.hash ? proposal.hash.slice(0, 16) : 'calculating...'}...
        </span>
        <span>Non-mutating preview active</span>
      </div>

      {actionError && (
        <div className="mt-2 rounded bg-rose-950/50 p-2 text-xs text-rose-300 border border-rose-500/30">
          {actionError}
        </div>
      )}

      {/* Interactive Human Consent Buttons */}
      <div className="mt-3.5 pt-2.5 border-t border-amber-500/20">
        {isPending && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-amber-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                Human Consent Gate Required
              </span>
              <span className="text-[10px] text-slate-400">Copilot cannot self-approve</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="approve-proposal-btn"
                onClick={handleApprove}
                disabled={isActing || isSyncing}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {isActing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Approve Changes</span>
              </button>
              <button
                type="button"
                data-testid="reject-proposal-btn"
                onClick={handleReject}
                disabled={isActing || isSyncing}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
              >
                {isActing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span>Reject</span>
              </button>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-emerald-300">
              Human approved. Ready to apply to authoritative state.
            </span>
            <button
              type="button"
              data-testid="apply-proposal-btn"
              onClick={handleApply}
              disabled={isActing || isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {isActing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              <span>Commit & Apply</span>
            </button>
          </div>
        )}

        {isApplied && (
          <div className="flex items-center gap-2 text-xs text-blue-300 font-medium">
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
            <span>
              Successfully committed to room version v
              {proposal.appliedVersion ?? proposal.baseVersion + 1}.
            </span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>Proposal rejected by human reviewer. Room state preserved.</span>
          </div>
        )}
      </div>
    </div>
  );
}
