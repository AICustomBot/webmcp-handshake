'use client';

import { useEffect } from 'react';
import { Bot, Sparkles, X, ShieldCheck, Hash, Cpu } from 'lucide-react';
import { useStudioStore } from '../../lib/store/studio-store';
import { useWebMCP } from '../../hooks/use-webmcp';
import { ChatInterface } from './chat-interface';

export function CopilotDrawer() {
  const { isCopilotOpen, setCopilotOpen, sessionId, roomState } = useStudioStore();
  const { isAvailable, isRegistered, registeredCount, isChatGPTBrowser } = useWebMCP();

  // Handle escape key to close drawer
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

  return (
    <div
      data-testid="copilot-drawer-container"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      aria-modal="true"
      role="dialog"
      aria-label="Handshake AI Copilot"
    >
      {/* Click outside backdrop to close */}
      <div className="fixed inset-0" onClick={() => setCopilotOpen(false)} aria-hidden="true" />

      {/* Slide-over Drawer Panel */}
      <div
        data-testid="copilot-drawer"
        className="relative z-10 flex h-[100dvh] w-full flex-col border-l border-slate-800 bg-slate-950 shadow-2xl transition-transform sm:w-[460px] md:w-[500px] max-w-full overflow-hidden"
      >
        {/* Drawer Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 shadow-inner">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">AI Co-Design Copilot</h2>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                  Vercel AI SDK
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-indigo-400" />
                  {isAvailable
                    ? `WebMCP Native (${registeredCount} tools)`
                    : isChatGPTBrowser
                      ? 'ChatGPT WebView Bridge'
                      : 'In-App Copilot Bridge (9 tools)'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionId && (
              <span className="hidden rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-300 sm:inline-block">
                #{sessionId.slice(0, 6)}
              </span>
            )}
            <button
              type="button"
              data-testid="close-copilot-btn"
              onClick={() => setCopilotOpen(false)}
              aria-label="Close Copilot drawer"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Drawer Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
