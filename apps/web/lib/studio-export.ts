/**
 * High-resolution canvas snapshot export utility for client design presentations.
 * Supports capturing both the 2D architectural SVG and the React Three Fiber 3D WebGL canvas.
 */
export async function captureCanvasSnapshot(options: {
  viewportMode: '2d' | '3d';
  sessionId?: string | null;
  version?: number;
}): Promise<string | null> {
  const { viewportMode, sessionId = 'design', version = 0 } = options;
  const safeSession = (sessionId || 'session').slice(0, 8);
  const filename = `handshake-${viewportMode}-snapshot-${safeSession}-v${version}.png`;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    if (viewportMode === '3d') {
      const container = document.getElementById('handshake-canvas-3d-container');
      const canvas = container?.querySelector('canvas') ?? document.querySelector('canvas');
      if (!canvas) {
        throw new Error('3D WebGL canvas element not found in DOM');
      }
      const dataUrl = canvas.toDataURL('image/png');
      triggerDownload(dataUrl, filename);
      return dataUrl;
    } else {
      const svg = document.getElementById('handshake-canvas-2d') as SVGSVGElement | null;
      if (!svg) {
        throw new Error('2D architectural SVG canvas not found in DOM');
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const scale = 2; // 2x high-resolution capture for architectural sharpness
            const width = (svg.clientWidth || 1200) * scale;
            const height = (svg.clientHeight || 800) * scale;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(svgUrl);
              return;
            }
            ctx.fillStyle = '#0b0f19'; // background matching studio theme
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const pngUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(svgUrl);
            resolve(pngUrl);
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          const fallbackUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
          resolve(fallbackUri);
        };
        img.src = svgUrl;
      });

      triggerDownload(dataUrl, filename);
      return dataUrl;
    }
  } catch (err) {
    console.error('[Handshake] Canvas snapshot capture error:', err);
    return null;
  }
}

function triggerDownload(dataUrl: string, filename: string) {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
