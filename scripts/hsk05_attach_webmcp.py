from pathlib import Path
p = Path('apps/web/public/index.html')
s = p.read_text()
old = '    <script type="module" src="./app.js"></script>\n'
new = old + '    <script type="module" src="./webmcp.js"></script>\n'
assert old in s and 'webmcp.js' not in s
p.write_text(s.replace(old, new))
