from pathlib import Path
p=Path('apps/worker/src/index.ts')
s=p.read_text()
old="""    const session = await this.ctx.storage.get<StoredSession>(SESSION_KEY);
    if (session === undefined) return failure(requestId, 'SESSION_NOT_FOUND', 'Session not found.');
    const routeSession = request.headers.get('x-route-session');"""
new="""    const session = await this.ctx.storage.get<StoredSession>(SESSION_KEY);
    if (session === undefined) return failure(requestId, 'SESSION_NOT_FOUND', 'Session not found.');
    const needsEvidenceNormalization =
      session.confirmations === undefined ||
      session.events === undefined ||
      session.actionResults === undefined;
    session.confirmations ??= {};
    session.events ??= [];
    session.actionResults ??= {};
    if (needsEvidenceNormalization) await this.ctx.storage.put(SESSION_KEY, session);
    const routeSession = request.headers.get('x-route-session');"""
if old not in s: raise SystemExit('normalization anchor missing')
p.write_text(s.replace(old,new))
