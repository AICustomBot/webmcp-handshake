'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  Eye,
  Check,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store/studio-store';
import { type Operation, type Proposal, type Product } from '@handshake/contracts';
import { FALLBACK_CATALOG } from '@/components/studio/canvas-2d-utils';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'proposal' | 'nkba' | 'bom' | 'protected_action';
  data?: any;
}

const QUICK_PROMPTS = [
  { label: '📐 Check NKBA Rules', prompt: 'Evaluate our layout against NKBA clearance guidelines' },
  { label: '✨ Propose Dishwasher', prompt: 'Propose adding a 24" dishwasher next to the sink' },
  { label: '🏝️ Propose Island', prompt: 'Propose a kitchen island in the center of the room' },
  {
    label: '📦 Bill of Materials',
    prompt: 'Calculate the itemized bill of materials and remaining budget',
  },
  { label: '📅 Book Consultation', prompt: 'Request a showroom design consultation' },
];

export function CopilotDrawer() {
  const {
    sessionId,
    capability,
    roomState,
    evaluation,
    catalog,
    activeProposal,
    isCopilotOpen,
    isSyncing,
    setCopilotOpen,
    propose,
    decide,
    apply,
    setActiveProposal,
    requestConfirmation,
    executeProtectedAction,
  } = useStudioStore();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Handshake AI Copilot. I can inspect your room dimensions, evaluate NKBA clearance rules, propose parametric fixtures, or prepare your itemized Bill of Materials. How can I assist with your design?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isCopilotOpen) {
      scrollToBottom();
    }
  }, [messages, isCopilotOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCopilotOpen) {
        setCopilotOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCopilotOpen, setCopilotOpen]);

  if (!isCopilotOpen) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isProcessing) return;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setActionSuccess(null);

    const q = query.toLowerCase();

    setTimeout(async () => {
      try {
        if (
          q.includes('nkba') ||
          q.includes('clearance') ||
          q.includes('rule') ||
          q.includes('triangle')
        ) {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content:
                'I have evaluated your layout against NKBA clearance guidelines. Here are the clearance and work triangle findings for committed state:',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'nkba',
              data: evaluation,
            },
          ]);
        } else if (q.includes('dishwasher') || q.includes('dw')) {
          const operations: Operation[] = [
            {
              type: 'place',
              productId: 'dishwasher-24',
              x: 72,
              y: 0,
              rotation: 0,
            },
          ];
          const rationale =
            'Placed 24" dishwasher directly beside sink along North wall plumbing run.';
          const submittedProposal = await propose(operations, rationale);

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content:
                'I have created a non-mutating proposal to install a 24" dishwasher. The amber preview is now visible on both your 2D floorplan and 3D visualizer. Committed room state remains unmutated until you approve.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'proposal',
              data: submittedProposal,
            },
          ]);
        } else if (q.includes('island')) {
          const operations: Operation[] = [
            {
              type: 'place',
              productId: 'base-drawer-24',
              x: Math.round(((roomState?.widthIn || 144) - 24) / 2),
              y: Math.round(((roomState?.lengthIn || 144) - 24) / 2),
              rotation: 0,
            },
          ];
          const rationale =
            'Added central 24" preparation island module respecting minimum approach clearances.';
          const submittedProposal = await propose(operations, rationale);

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content:
                'I have generated a non-mutating proposal for a central island. Review the holographic preview on your canvas before approving.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'proposal',
              data: submittedProposal,
            },
          ]);
        } else if (
          q.includes('bom') ||
          q.includes('bill') ||
          q.includes('cost') ||
          q.includes('budget') ||
          q.includes('price')
        ) {
          const catalogList = catalog.length > 0 ? catalog : FALLBACK_CATALOG;
          const counts = new Map<string, number>();
          if (roomState) {
            for (const item of roomState.items) {
              counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
            }
          }
          const lineItems = Array.from(counts.entries()).map(([productId, quantity]) => {
            const product = catalogList.find((p) => p.id === productId);
            const unitPriceCents = product?.priceCents || 0;
            return {
              productId,
              product,
              quantity,
              unitPriceCents,
              subtotalCents: unitPriceCents * quantity,
            };
          });
          const totalCents = lineItems.reduce((sum, li) => sum + li.subtotalCents, 0);
          const budgetCents = roomState?.budgetCents || 2500000;
          const bomData = {
            totalCents,
            budgetCents,
            remainingBudgetCents: budgetCents - totalCents,
            lineItems,
          };

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content:
                'Here is the itemized Bill of Materials and budget breakdown calculated directly from your committed room state:',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'bom',
              data: bomData,
            },
          ]);
        } else if (
          q.includes('consultation') ||
          q.includes('book') ||
          q.includes('quote') ||
          q.includes('showroom')
        ) {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content:
                'Protected Action Requested: Under Handshake constitutional governance, agents cannot autonomously book appointments. Please review and confirm below to issue a single-use proof token.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'protected_action',
              data: { action: 'book_consultation', date: '2026-09-15', preferredTime: '10:00 AM' },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content: `Your active room is configured as a ${roomState?.roomType || 'kitchen'} (${roomState?.widthIn || 144}" x ${roomState?.lengthIn || 144}"). Currently containing ${roomState?.items.length || 0} placed fixtures at version ${roomState?.version ?? 0}. Try asking me to check NKBA compliance or propose a new layout element!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'text',
            },
          ]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: `Error executing command: ${err.message || 'Operation failed'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'text',
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    }, 400);
  };

  const handleApproveProposal = async (proposal: Proposal) => {
    if (!roomState) return;
    setIsProcessing(true);
    try {
      await decide(proposal.id, proposal.hash, 'approved');
      await apply(proposal.id, proposal.hash, roomState.version);
      setActionSuccess(
        `Proposal #${proposal.id.slice(0, 8)} approved and applied! Room updated to version ${roomState.version + 1}.`,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `✅ Proposal #${proposal.id.slice(0, 8)} has been successfully applied to room state! Committed version is now ${roomState.version + 1}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setActionSuccess(`Failed to apply proposal: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    setIsProcessing(true);
    try {
      await decide(proposal.id, proposal.hash, 'rejected');
      setActiveProposal(null);
      setActionSuccess(`Proposal #${proposal.id.slice(0, 8)} rejected.`);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `❌ Proposal #${proposal.id.slice(0, 8)} has been rejected. Canvas preview cleared.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setActionSuccess(`Failed to reject proposal: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmProtectedAction = async (
    action: 'book_consultation',
    details: Record<string, string>,
  ) => {
    setIsProcessing(true);
    try {
      const confRes = await requestConfirmation(action, details);
      if (confRes) {
        await executeProtectedAction(action, details, confRes.proof, confRes.confirmation.id);
        setActionSuccess('Showroom consultation booked with cryptographic proof!');
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: `🛡️ Protected action confirmed and executed! Proof token validated and receipt generated.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setActionSuccess(`Booking failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Handshake AI Copilot"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl sm:max-w-lg transition-transform duration-300 ease-in-out h-[100dvh]"
    >
      {/* Copilot Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Handshake AI Copilot</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>WebMCP 2.0</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Governed Co-Design Assistant &bull; Page-Owned Consent
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCopilotOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Close Copilot (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Action Notification Alert */}
      {actionSuccess && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/20 text-indigo-300">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                <p>{msg.content}</p>

                {/* Structured Card: Proposal */}
                {msg.type === 'proposal' && msg.data && (
                  <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                        <Layers className="h-4 w-4" />
                        <span>Proposal #{msg.data.id?.slice(0, 8) || 'preview'}</span>
                      </div>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 uppercase">
                        {msg.data.status || 'pending_human'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-1">
                      <p className="font-medium text-white">&ldquo;{msg.data.rationale}&rdquo;</p>
                      <p className="text-slate-400">
                        Target Version:{' '}
                        <span className="font-mono text-amber-300">
                          {msg.data.baseVersion ?? msg.data.expectedVersion ?? 0}
                        </span>{' '}
                        &bull; Operations:{' '}
                        <span className="font-mono">{msg.data.operations?.length || 1}</span>
                      </p>
                    </div>

                    {/* Page-Owned Consent Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                      <button
                        type="button"
                        onClick={() => handleApproveProposal(msg.data)}
                        disabled={isProcessing || isSyncing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve & Apply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectProposal(msg.data)}
                        disabled={isProcessing || isSyncing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveProposal(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-auto"
                      >
                        Dismiss Preview
                      </button>
                    </div>
                  </div>
                )}

                {/* Structured Card: NKBA Evaluation */}
                {msg.type === 'nkba' && msg.data && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2 text-slate-300 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>NKBA Compliance Findings</span>
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {msg.data.findings?.length || 0} findings
                      </span>
                    </div>

                    {!msg.data.findings || msg.data.findings.length === 0 ? (
                      <p className="text-emerald-400 text-xs">
                        All clearance corridors and work triangles compliant!
                      </p>
                    ) : (
                      <ul className="space-y-1 text-[11px]">
                        {msg.data.findings.slice(0, 4).map((f: any, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-slate-300">
                            <span className="text-amber-400 font-bold">&bull;</span>
                            <span>{f.message || f.code}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Structured Card: Bill of Materials */}
                {msg.type === 'bom' && msg.data && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2.5 text-slate-300 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        <span>Itemized Bill of Materials</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        ${((msg.data.totalCents || 0) / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      {msg.data.lineItems?.slice(0, 4).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-300">
                          <span>
                            {item.quantity}x {item.product?.name || item.productId}
                          </span>
                          <span className="font-mono text-slate-400">
                            ${((item.subtotalCents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between font-medium text-slate-200">
                      <span>Remaining Budget:</span>
                      <span className="font-mono text-emerald-400">
                        ${((msg.data.remainingBudgetCents || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Structured Card: Protected Action */}
                {msg.type === 'protected_action' && msg.data && (
                  <div className="mt-3 rounded-xl border border-blue-500/40 bg-blue-500/5 p-3 space-y-2 text-slate-300 text-xs">
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Protected Action: Showroom Consultation</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Date: <span className="text-white font-medium">{msg.data.date}</span> &bull;
                      Time: <span className="text-white font-medium">{msg.data.preferredTime}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleConfirmProtectedAction('book_consultation', {
                          date: msg.data.date,
                          preferredTime: msg.data.preferredTime,
                        })
                      }
                      disabled={isProcessing}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Confirm & Issue Single-Use Proof</span>
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 px-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
            <Bot className="h-4 w-4" />
            <span>AI Copilot evaluating design rules and tool contracts...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Quick Actions Bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/50 p-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {QUICK_PROMPTS.map((qp, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isProcessing}
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-indigo-500 hover:bg-indigo-600/20 hover:text-white transition-colors disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Bar */}
      <div className="border-t border-slate-800 bg-slate-900 p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot or propose a change..."
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>Proposals are non-mutating previews &bull; Consent is human-owned</span>
          <span className="font-mono">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
