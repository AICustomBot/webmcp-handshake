from pathlib import Path
p = Path('apps/web/public/app.js')
s = p.read_text()
old = "  renderCanvas();\n}\n\nfunction renderCatalog"
new = "  renderCanvas();\n  $('canvas-shell').focus();\n}\n\nfunction renderCatalog"
assert old in s
p.write_text(s.replace(old, new, 1))
