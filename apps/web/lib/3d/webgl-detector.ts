/**
 * WebGL Capability Detection and Context-Loss Monitoring
 * Designed for mobile WebViews (e.g. ChatGPT in-app browser, iOS WKWebView)
 */

export interface WebGLCapability {
  supported: boolean;
  version: 'webgl2' | 'webgl' | 'none';
  renderer?: string;
  vendor?: string;
  error?: string;
}

/**
 * Preflight check for WebGL hardware acceleration support.
 * Returns supported = false if in SSR, disabled, or security-blocked.
 */
export function checkWebGLCapability(): WebGLCapability {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      version: 'none',
      error: 'SSR environment — DOM window/document is undefined',
    };
  }

  try {
    const canvas = document.createElement('canvas');

    // 1. Try WebGL2 first
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      let renderer = 'Standard WebGL2';
      let vendor = 'Standard Vendor';
      try {
        const ext = gl2.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          renderer = gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
          vendor = gl2.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor;
        }
      } catch {
        // Some restricted environments disallow debug extensions
      }
      return {
        supported: true,
        version: 'webgl2',
        renderer,
        vendor,
      };
    }

    // 2. Try WebGL1 / experimental
    const gl1 =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (gl1) {
      let renderer = 'Standard WebGL1';
      let vendor = 'Standard Vendor';
      try {
        const ext = gl1.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          renderer = gl1.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
          vendor = gl1.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor;
        }
      } catch {
        // Ignored
      }
      return {
        supported: true,
        version: 'webgl',
        renderer,
        vendor,
      };
    }

    return {
      supported: false,
      version: 'none',
      error: 'WebGL context creation returned null in host browser environment',
    };
  } catch (err) {
    return {
      supported: false,
      version: 'none',
      error: err instanceof Error ? err.message : 'Unknown WebGL context error',
    };
  }
}

/** Convenient boolean check */
export function isWebGLAvailable(): boolean {
  return checkWebGLCapability().supported;
}
