'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import { useWebMCP } from '../../hooks/use-webmcp';
import { useStudioStore } from '../../lib/store/studio-store';

export function WebMCPFallbackBanner() {
  const { isAvailable, isChatGPTBrowser } = useWebMCP();
  const { isCopilotOpen, setCopilotOpen } = useStudioStore();
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const wasDismissed = sessionStorage.getItem('handshake_webmcp_fallback_dismissed');
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  if (!mounted || isAvailable || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('handshake_webmcp_fallback_dismissed', 'true');
    } catch {}
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="webmcp-fallback-banner"
      className="border-b border-indigo-500/30 bg-gradient-to-r from-indigo-950/90 via-slate-900/90 to-purple-950/90 px-4 py-3 text-slate-200 backdrop-blur-md transition-all"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/20 text-indigo-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-white">
              {isChatGPTBrowser
                ? 'ChatGPT In-App Browser Mode'
                : 'WebMCP Mode: In-App AI Copilot Ready'}
            </span>
            <span className="mx-2 text-slate-500">&bull;</span>
            <span className="text-slate-300">
              {isChatGPTBrowser
                ? 'External WebMCP model context is restricted in this WebView. The built-in AI Copilot is fully active with all 9 design tools.'
                : 'Native document.modelContext was not detected. Launch the built-in AI Copilot drawer to co-design with AI.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCopilotOpen && (
            <button
              type="button"
              data-testid="open-copilot-banner-btn"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Open AI Copilot</span>
            </button>
          )}

          <button
            type="button"
            data-testid="dismiss-banner-btn"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
