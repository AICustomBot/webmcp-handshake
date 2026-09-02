from pathlib import Path

index = Path('apps/worker/src/index.ts')
s = index.read_text()

s = s.replace(
"import { CONTRACT_VERSION, LIMITS } from '@handshake/contracts';",
"import { CONTRACT_VERSION, LIMITS } from '@handshake/contracts';\nimport { parseApiRoute, readBoundedJson } from './runtime-utils';\nexport { parseApiRoute, readBoundedJson } from './runtime-utils';\nexport type { ApiRoute } from './runtime-utils';",
)
s = s.replace('  statusAfterCommittedChange,\n', '  statusAfterCommittedChange,\n  validateOperations,\n')

start = s.index('export interface ApiRoute {')
end = s.index('/** Maps stable errors', start)
s = s[:start] + s[end:]

start = s.index('/** Reads JSON while enforcing')
end = s.index('/** Creates a request with a replayable', start)
s = s[:start] + s[end:]

s = s.replace(
"headers: { 'content-type': 'application/json', 'x-request-id': requestId },\n        body: JSON.stringify({ sessionId, capability, ...body }),",
"headers: {\n          'content-type': 'application/json',\n          'x-request-id': requestId,\n          'x-handshake-internal': 'init',\n        },\n        body: JSON.stringify({\n          widthIn: body.widthIn,\n          lengthIn: body.lengthIn,\n          budgetCents: body.budgetCents,\n          sessionId,\n          capability,\n        }),",
)
s = s.replace(
"  const route = parseApiRoute(url.pathname);\n  if (route === null) return failure(requestId, 'INVALID_INPUT', 'Unknown API route.');",
"  const route = parseApiRoute(url.pathname);\n  if (route === null) return failure(requestId, 'INVALID_INPUT', 'Unknown API route.');\n  if (route.resource === 'init') {\n    return failure(requestId, 'FORBIDDEN_ACTOR', 'Internal route.');\n  }",
)
s = s.replace(
'    return stub.fetch(new Request(forwarded, { headers }));',
'    return await stub.fetch(new Request(forwarded, { headers }));',
)

old_fetch = """  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);"""
new_fetch = """  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(() => this.handle(request));
  }

  /** Serializes one complete read-modify-write operation. */
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);"""
s = s.replace(old_fetch, new_fetch)

s = s.replace(
"""    if (url.pathname === '/init' && request.method === 'POST') {
      return this.initialize(request, requestId);
    }""",
"""    if (url.pathname === '/init' && request.method === 'POST') {
      if (request.headers.get('x-handshake-internal') !== 'init') {
        return failure(requestId, 'FORBIDDEN_ACTOR', 'Internal route.');
      }
      try {
        return await this.initialize(request, requestId);
      } catch (error) {
        const code = error instanceof RangeError ? 'LIMIT_EXCEEDED' : 'INVALID_INPUT';
        return failure(requestId, code, 'Session input was invalid.');
      }
    }""",
)

old_apply = """    if (body.expectedVersion !== session.state.version) {
      return failure(requestId, 'VERSION_CONFLICT', 'Committed state changed.');
    }
    const payloadHash = await requestHash(body);
    const replay = checkIdempotency(session.idempotency[body.idempotencyKey], payloadHash);"""
new_apply = """    const payloadHash = await requestHash(body);
    const replay = checkIdempotency(session.idempotency[body.idempotencyKey], payloadHash);"""
s = s.replace(old_apply, new_apply)
s = s.replace(
"""    if (replay.outcome === 'conflict') {
      return failure(requestId, replay.code, 'Idempotency key was reused with different content.');
    }
    const decision = await mayApplyWithHash({""",
"""    if (replay.outcome === 'conflict') {
      return failure(requestId, replay.code, 'Idempotency key was reused with different content.');
    }
    if (body.expectedVersion !== session.state.version) {
      return failure(requestId, 'VERSION_CONFLICT', 'Committed state changed.');
    }
    const decision = await mayApplyWithHash({""",
1,
)

s = s.replace(
"""    session.state = reduced.state;
    session.proposals[applied.id] = applied;
    session.idempotency[body.idempotencyKey] = {""",
"""    session.state = reduced.state;
    session.proposals[applied.id] = applied;
    for (const other of Object.values(session.proposals)) {
      if (other.id === applied.id) continue;
      other.status = statusAfterCommittedChange(other, session.state.version);
    }
    session.idempotency[body.idempotencyKey] = {""",
)

s = s.replace(
"""    const reduced = applyOperations(session.state, body.operations, () => crypto.randomUUID());
    if (!reduced.ok) return failure(requestId, reduced.code, 'Edit could not be applied.');""",
"""    const validation = Array.isArray(body.operations)
      ? validateOperations(body.operations)
      : { allowed: false as const, code: 'INVALID_INPUT' as const };
    if (!validation.allowed) {
      return failure(requestId, validation.code, 'Edit operations were invalid.');
    }
    const reduced = applyOperations(session.state, body.operations, () => crypto.randomUUID());
    if (!reduced.ok) return failure(requestId, reduced.code, 'Edit could not be applied.');""",
)

index.write_text(s)

utils = Path('apps/worker/src/runtime-utils.ts')
u = utils.read_text()
u = u.replace(
"  return { sessionId: decodeURIComponent(sessionId), resource: match[2] ?? '' };",
"""  try {
    return { sessionId: decodeURIComponent(sessionId), resource: match[2] ?? '' };
  } catch {
    return null;
  }""",
)
utils.write_text(u)

doc = Path('docs/RUNTIME.md')
d = doc.read_text().replace(
"""Cloudflare serializes requests to one Durable Object. Every proposal, decision,
apply and direct edit reads and writes the one `session` storage record inside
that object. Expected-version checks happen immediately before mutation.""",
"""Cloudflare storage input gates protect outstanding storage operations, but body
reads and hashing can otherwise interleave. `DesignSession.fetch` therefore wraps
each complete read-modify-write in `blockConcurrencyWhile`. Expected-version and
idempotency checks run inside that serialized operation immediately before the
mutation is persisted.""",
)
doc.write_text(d)

test = Path('tests/runtime.test.ts')
t = test.read_text()
t = t.replace(
"""  it('does not interpret an encoded slash as a route separator', () => {
    expect(parseApiRoute('/api/v1/sessions/a%2Fb/state')).toEqual({
      sessionId: 'a/b',
      resource: 'state',
    });
  });""",
"""  it('does not interpret an encoded slash as a route separator', () => {
    expect(parseApiRoute('/api/v1/sessions/a%2Fb/state')).toEqual({
      sessionId: 'a/b',
      resource: 'state',
    });
  });

  it('fails closed on malformed percent encoding', () => {
    expect(parseApiRoute('/api/v1/sessions/%zz/state')).toBeNull();
  });""",
)
test.write_text(t)
