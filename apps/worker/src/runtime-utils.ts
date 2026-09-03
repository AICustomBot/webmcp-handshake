import { LIMITS } from '@handshake/contracts';

export interface ApiRoute {
  sessionId: string;
  resource: string;
}

/** Parses a versioned session route without accepting extra path segments. */
export function parseApiRoute(pathname: string): ApiRoute | null {
  const match = /^\/api\/v1\/sessions\/([^/]+)(?:\/([^/]+))?$/.exec(pathname);
  if (match === null) return null;
  const sessionId = match[1];
  if (sessionId === undefined) return null;
  try {
    return { sessionId: decodeURIComponent(sessionId), resource: match[2] ?? '' };
  } catch {
    return null;
  }
}

/** Reads JSON while enforcing the actual body size, not only Content-Length. */
export async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > LIMITS.maxBodyBytes) {
    throw new RangeError('Request body exceeds the configured limit.');
  }

  if (request.body && typeof request.body.getReader === 'function') {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > LIMITS.maxBodyBytes) {
            await reader.cancel('Body exceeds maximum allowed size');
            throw new RangeError('Request body exceeds the configured limit.');
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (totalBytes === 0) return {};
    const fullBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(fullBuffer)) as unknown;
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > LIMITS.maxBodyBytes) {
    throw new RangeError('Request body exceeds the configured limit.');
  }
  if (bytes.byteLength === 0) return {};
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
