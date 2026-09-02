from pathlib import Path
p=Path('apps/worker/src/protected-runtime.ts')
s=p.read_text()
s=s.replace('  confirmationId?: string;\n  proof?: string;', '  confirmationId?: string | undefined;\n  proof?: string | undefined;')
p.write_text(s)
