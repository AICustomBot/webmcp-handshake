from pathlib import Path
p=Path('apps/worker/src/index.ts')
s=p.read_text()
s=s.replace("import type { StoredConfirmation } from './evidence';", "import type { StoredConfirmation } from './evidence';\nimport { SYNTHETIC_CATALOG } from './catalog';")
s=s.replace("return success(requestId, { state: session.state });", "return success(requestId, {\n          state: session.state,\n          evaluation: evaluateDesign(session.state, SYNTHETIC_CATALOG),\n        });", 1)
s=s.replace("evaluateDesign(session.state, []),", "evaluateDesign(session.state, SYNTHETIC_CATALOG),")
p.write_text(s)

w=Path('apps/web/public/webmcp.js')
t=w.read_text()
old="""      return payload.ok
        ? result({
            ok: true,
            requestId: payload.requestId,
            data: { evaluation: evaluate(payload.data.state) },
          })
        : result(payload);"""
new="""      return payload.ok
        ? result({
            ok: true,
            requestId: payload.requestId,
            data: { evaluation: payload.data.evaluation },
          })
        : result(payload);"""
if old not in t: raise SystemExit('evaluation anchor missing')
t=t.replace(old,new)
w.write_text(t)
