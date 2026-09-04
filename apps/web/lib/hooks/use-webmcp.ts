export * from '../../hooks/use-webmcp';

export function isChatGPTInAppBrowser(customUA?: string): boolean {
  const ua = customUA ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '';
  if (!ua) return false;
  // Check for ChatGPT in-app browser or OpenAI webview signatures
  return /ChatGPT|OAIWebView|KASAN/i.test(ua);
}
