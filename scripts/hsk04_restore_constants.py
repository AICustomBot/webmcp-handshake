from pathlib import Path
p = Path('apps/worker/src/index.ts')
s = p.read_text()
anchor = "interface EditBody {\n  expectedVersion: number;\n  operations: Operation[];\n}\n"
constants = "\nconst SESSION_KEY = 'session';\nconst CAPABILITY_HEADER = 'x-handshake-capability';\nconst ACTOR_HEADER = 'x-handshake-actor';\nconst DEFAULT_ROOM = { widthIn: 108, lengthIn: 132, budgetCents: 1400000 } as const;\n"
assert anchor in s
assert 'const SESSION_KEY' not in s
p.write_text(s.replace(anchor, anchor + constants))
