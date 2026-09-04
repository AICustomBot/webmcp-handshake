'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  Loader2,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type {
  Proposal,
  Operation,
  ProtectedAction,
  ProtectedActionResponse,
} from '@handshake/contracts';
import { useStudioStore } from '../../lib/store/studio-store';
import { ProposalApprovalCard } from './proposal-approval-card';
import { ProtectedActionCard } from './protected-action-card';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args: Record<string, any>;
  };
  proposal?: Proposal;
  protectedAction?: {
    action: ProtectedAction;
    payload: Record<string, string>;
  };
  findings?: Array<{ code: string; severity: string; message: string }>;
  bomData?: { totalCents: number; itemsCount: number };
}

export const QUICK_PROMPTS = [
  { label: '📐 Check NKBA Rules', prompt: 'Evaluate our layout against NKBA clearance guidelines' },
  { label: '✨ Propose Dishwasher', prompt: 'Propose adding a 24" dishwasher next to the sink' },
  { label: '🏝️ Propose Island', prompt: 'Propose a kitchen island in the center of the room' },
  {
    label: '📦 Bill of Materials',
    prompt: 'Calculate the itemized bill of materials and remaining budget',
  },
  { label: '📅 Book Consultation', prompt: 'Request a showroom design consultation' },
];

export function ChatInterface() {
  const {
    sessionId,
    roomState,
    evaluation,
    catalog,
    activeProposal,
    isSyncing,
    propose,
    decide,
    apply,
    requestConfirmation,
    executeProtectedAction,
    refreshState,
  } = useStudioStore();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Handshake AI Copilot. I can inspect your room dimensions, evaluate NKBA clearance rules, propose parametric fixtures, or prepare your itemized Bill of Materials. How can I assist with your design?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isProcessing) return;

    const userMessageId = `user_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setStatusNotice(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessageId = `assistant_${Date.now()}`;
      let createdProposal: Proposal | undefined = undefined;
      let protectedActionData:
        { action: ProtectedAction; payload: Record<string, string> } | undefined = undefined;
      let findingsList: Array<{ code: string; severity: string; message: string }> | undefined =
        undefined;
      let bomSummary: { totalCents: number; itemsCount: number } | undefined = undefined;

      // Handle tool call dispatched by Copilot
      if (data.toolCall) {
        const { name, args } = data.toolCall;

        if (name === 'propose_changes' && args?.operations) {
          // Autonomous agent calls propose_changes -> strictly non-mutating preview
          if (sessionId && roomState) {
            const proposal = await propose(
              args.operations,
              args.rationale || 'Proposed by AI Copilot',
            );
            if (proposal) {
              createdProposal = proposal;
            }
          }
        } else if (name === 'request_protected_action' && args?.action) {
          // Protected action triggers human confirmation card
          protectedActionData = {
            action: args.action,
            payload: args.payload || {},
          };
        } else if (name === 'evaluate_design') {
          // Real-time NKBA findings
          if (evaluation?.findings) {
            findingsList = evaluation.findings.map((f) => ({
              code: f.code,
              severity: f.severity,
              message: f.message,
            }));
          }
        } else if (name === 'get_bill_of_materials') {
          if (roomState && evaluation) {
            bomSummary = {
              totalCents: evaluation.committedCents,
              itemsCount: roomState.items.length,
            };
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: data.content || 'I have processed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCall: data.toolCall,
        proposal: createdProposal,
        protectedAction: protectedActionData,
        findings: findingsList,
        bomData: bomSummary,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `Apologies, I encountered an issue processing that: ${err.message || 'Unknown error'}. You can continue designing manually using the 2D architectural or 3D canvas.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveProposal = async (proposal: Proposal) => {
    const updated = await decide(proposal.id, proposal.hash, 'approved');
    if (updated) {
      setMessages((prev) =>
        prev.map((msg) => (msg.proposal?.id === proposal.id ? { ...msg, proposal: updated } : msg)),
      );
      setStatusNotice(`Proposal #${proposal.id.slice(0, 8)} approved by human.`);
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    const updated = await decide(proposal.id, proposal.hash, 'rejected');
    if (updated) {
      setMessages((prev) =>
        prev.map((msg) => (msg.proposal?.id === proposal.id ? { ...msg, proposal: updated } : msg)),
      );
      setStatusNotice(`Proposal #${proposal.id.slice(0, 8)} rejected. Room state preserved.`);
    }
  };

  const handleApplyProposal = async (proposal: Proposal) => {
    await apply(proposal.id, proposal.hash, proposal.baseVersion);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.proposal?.id === proposal.id
          ? {
              ...msg,
              proposal: {
                ...proposal,
                status: 'applied',
                appliedVersion: proposal.baseVersion + 1,
              },
            }
          : msg,
      ),
    );
    setStatusNotice(`Proposal #${proposal.id.slice(0, 8)} applied. Committed room state updated!`);
    await refreshState();
  };

  const handleConfirmProtectedAction = async (
    action: ProtectedAction,
    payload: Record<string, string>,
  ): Promise<ProtectedActionResponse | null> => {
    const confRes = await requestConfirmation(action, payload);
    if (!confRes || !confRes.proof) {
      return null;
    }
    const execRes = await executeProtectedAction(
      action,
      payload,
      confRes.proof,
      confRes.confirmation.id,
    );
    return execRes;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Telemetry Status Bar */}
      {statusNotice && (
        <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-xs text-emerald-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            &times;
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/20 text-indigo-300">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm sm:max-w-[80%] ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Structured Findings (NKBA) */}
                {msg.findings && msg.findings.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-2">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      <span>NKBA Guidelines Findings</span>
                    </div>
                    {msg.findings.map((f, i) => (
                      <div
                        key={i}
                        className={`rounded px-2 py-1 text-[11px] ${
                          f.severity === 'blocked'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span className="font-semibold uppercase text-[10px]">[{f.severity}]</span>{' '}
                        {f.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Bill of Materials Summary */}
                {msg.bomData && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Total Fixtures Placed:</span>
                      <span className="font-semibold text-white">{msg.bomData.itemsCount}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-300">
                      <span>Committed Subtotal:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        ${(msg.bomData.totalCents / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Proposal Approval Card (Constitutional Invariant: Human review required) */}
                {msg.proposal && (
                  <ProposalApprovalCard
                    proposal={msg.proposal}
                    onApprove={handleApproveProposal}
                    onReject={handleRejectProposal}
                    onApply={handleApplyProposal}
                    isSyncing={isSyncing}
                  />
                )}

                {/* Protected Action Card */}
                {msg.protectedAction && (
                  <ProtectedActionCard
                    action={msg.protectedAction.action}
                    payload={msg.protectedAction.payload}
                    onConfirm={handleConfirmProtectedAction}
                    isSyncing={isSyncing}
                  />
                )}

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{msg.timestamp}</span>
                  {msg.toolCall && (
                    <span className="font-mono text-[9px] text-indigo-400">
                      tool: {msg.toolCall.name}
                    </span>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-500/20 text-blue-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span>AI Copilot is thinking and evaluating design rules...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="border-t border-slate-800 bg-slate-900/50 p-2.5">
        <div className="mb-1.5 text-[11px] font-medium text-slate-400">
          Suggested Architectural Prompts:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isProcessing}
              className="rounded-full border border-slate-700/80 bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-indigo-500/50 hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 p-3"
      >
        <input
          type="text"
          data-testid="copilot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot (e.g. 'Propose a 24-inch dishwasher next to sink')..."
          disabled={isProcessing}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="copilot-send-btn"
          disabled={isProcessing || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
