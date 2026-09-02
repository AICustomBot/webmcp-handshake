from pathlib import Path

p=Path('apps/worker/src/index.ts')
s=p.read_text()
s=s.replace("import { SYNTHETIC_CATALOG } from './catalog';", "import { SYNTHETIC_CATALOG } from './catalog';\nimport { healthResponse } from './health';")
old="""  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);"""
new="""  const url = new URL(request.url);
  if (url.pathname === '/healthz') return healthResponse(request);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);"""
if old not in s: raise SystemExit('worker route anchor missing')
p.write_text(s.replace(old,new))

p=Path('tests/runtime.test.ts')
s=p.read_text()
anchor="""  it('rejects malformed JSON without recovering unsafely', async () => {"""
insert="""  it('rejects an oversized streamed body without a content-length header', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(LIMITS.maxBodyBytes + 1)));
        controller.close();
      },
    });
    const request = new Request('https://example.test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    expect(request.headers.has('content-length')).toBe(false);
    await expect(readBoundedJson(request)).rejects.toThrow(RangeError);
  });

  it('rejects malformed JSON without recovering unsafely', async () => {"""
if anchor not in s: raise SystemExit('runtime test anchor missing')
p.write_text(s.replace(anchor,insert))
