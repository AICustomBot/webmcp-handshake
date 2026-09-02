import { CONTRACT_VERSION } from '@handshake/contracts';

/** Returns a public, secret-free liveness response for deployment verification. */
export function healthResponse(request: Request): Response {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }
  return Response.json({
    ok: true,
    service: 'handshake',
    contractVersion: CONTRACT_VERSION,
  });
}
