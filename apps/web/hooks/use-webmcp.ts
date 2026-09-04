'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerModelContextTools,
  WEBMCP_TOOL_NAMES,
  type WebMCPToolName,
} from '../lib/webmcp/webmcp-tools';

export interface UseWebMCPReturn {
  isAvailable: boolean;
  isRegistered: boolean;
  registeredCount: number;
  toolNames: readonly WebMCPToolName[];
  isChatGPTBrowser: boolean;
  error: string | null;
  retryRegistration: () => void;
}

/**
 * Detects whether the current execution context is inside ChatGPT's in-app browser
 * or an embedded mobile WebView.
 */
export function isChatGPTInAppBrowser(customUA?: string): boolean {
  const ua = customUA ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '';
  if (!ua) {
    return false;
  }
  // Check for ChatGPT in-app browser or OpenAI webview signatures
  return /ChatGPT|OAIWebView|KASAN/i.test(ua);
}

/**
 * React hook that manages the WebMCP browser bridge lifecycle on document.modelContext.
 * Registers all 9 contracted tools on mount and cleanly unregisters on unmount or pagehide.
 */
export function useWebMCP(): UseWebMCPReturn {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatGPT, setIsChatGPT] = useState<boolean>(false);

  const attemptRegistration = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const inAppChatGPT = isChatGPTInAppBrowser();
    setIsChatGPT(inAppChatGPT);

    const modelContext = (document as any).modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      setIsAvailable(false);
      setIsRegistered(false);
      setRegisteredCount(0);
      setError('document.modelContext is not supported in this browser runtime.');

      // Notify page of WebMCP unavailability so fallback UI can activate
      window.dispatchEvent(
        new CustomEvent('handshake:webmcp-unavailable', {
          detail: {
            isChatGPTBrowser: inAppChatGPT,
            reason: 'document.modelContext unavailable',
          },
        }),
      );
      return;
    }

    setIsAvailable(true);
    setError(null);

    const { registeredCount: count, unregister } = registerModelContextTools(modelContext);
    setRegisteredCount(count);
    setIsRegistered(count > 0);

    const onPageHide = () => {
      unregister();
    };

    window.addEventListener('pagehide', onPageHide, { once: true });

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      unregister();
    };
  }, []);

  useEffect(() => {
    const cleanup = attemptRegistration();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [attemptRegistration]);

  return {
    isAvailable,
    isRegistered,
    registeredCount,
    toolNames: WEBMCP_TOOL_NAMES,
    isChatGPTBrowser: isChatGPT,
    error,
    retryRegistration: attemptRegistration,
  };
}
