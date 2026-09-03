#!/usr/bin/env python3
"""
Generates production vector and raster brand identity assets for Handshake:
- apps/web/public/favicon.svg (SVG Favicon with dark/light mode optimization)
- apps/web/public/logo.svg (Full horizontal vector logo with typography)
- apps/web/public/favicon.png (32x32 crisp raster icon)
- apps/web/public/apple-touch-icon.png (180x180 iOS home screen icon)
- apps/web/public/logo.png (High-res 512x512 icon for PWA/manifest)
"""

import os
from playwright.sync_api import sync_playwright

PUBLIC_DIR = os.path.abspath("apps/web/public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="agentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="humanGrad" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="proofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="markShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect width="64" height="64" rx="15" fill="#0f172a"/>
  
  <!-- Architectural Drafting Crosshair (Subtle) -->
  <line x1="10" y1="32" x2="54" y2="32" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="3 3"/>
  <line x1="32" y1="10" x2="32" y2="54" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="3 3"/>

  <!-- Left Band: AI Agent Hand & Arm (Blue) -->
  <path d="M 13 27 L 22 17 C 25.5 13.5 31 13.5 34.5 17 L 38 20.5 C 41 23.5 41 28.5 38 31.5 L 33 36.5 L 25.5 44 C 22 47.5 16.5 47.5 13 44 L 11 42"
        fill="none"
        stroke="url(#agentGrad)"
        stroke-width="6.5"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Right Band: Human Hand & Arm (Emerald) -->
  <path d="M 51 37 L 42 47 C 38.5 50.5 33 50.5 29.5 47 L 26 43.5 C 23 40.5 23 35.5 26 32.5 L 31 27.5 L 38.5 20 C 42 16.5 47.5 16.5 51 20 L 53 22"
        fill="none"
        stroke="url(#humanGrad)"
        stroke-width="6.5"
        stroke-linecap="round"
        stroke-linejoin="round"/>

  <!-- Central Proof Jewel / Check Node -->
  <circle cx="32" cy="32" r="3.75" fill="url(#proofGrad)" filter="url(#markShadow)"/>
</svg>
"""

LOGO_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 56" width="250" height="56" fill="none">
  <defs>
    <linearGradient id="logoAgent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="logoHuman" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="logoProof" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Mark Container -->
  <g transform="translate(4, 4)">
    <rect width="48" height="48" rx="12" fill="#0f172a"/>
    <line x1="8" y1="24" x2="40" y2="24" stroke="#1e293b" stroke-width="1" stroke-dasharray="2.5 2.5"/>
    <line x1="24" y1="8" x2="24" y2="40" stroke="#1e293b" stroke-width="1" stroke-dasharray="2.5 2.5"/>
    
    <!-- Agent Band -->
    <path d="M 10 20 L 17 13 C 19.5 10.5 23.5 10.5 26 13 L 29 16 C 31 18 31 22 29 24 L 25 28 L 19 34 C 16.5 36.5 12.5 36.5 10 34 L 8 32"
          fill="none" stroke="url(#logoAgent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Human Band -->
    <path d="M 38 28 L 31 35 C 28.5 37.5 24.5 37.5 22 35 L 19 32 C 17 30 17 26 19 24 L 23 20 L 29 14 C 31.5 11.5 35.5 11.5 38 14 L 40 16"
          fill="none" stroke="url(#logoHuman)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Proof Jewel -->
    <circle cx="24" cy="24" r="3" fill="url(#logoProof)" filter="url(#logoShadow)"/>
  </g>

  <!-- Typography -->
  <text x="64" y="31" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" letter-spacing="-0.03em" fill="#0f172a">Handshake</text>
  <text x="65" y="46" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="700" letter-spacing="0.08em" fill="#64748b">DESIGN TOGETHER • APPROVE WITH PROOF</text>
</svg>
"""

# 1. Write vector SVG files
favicon_svg_path = os.path.join(PUBLIC_DIR, "favicon.svg")
with open(favicon_svg_path, "w") as f:
    f.write(FAVICON_SVG.strip())
print(f"✓ Written {favicon_svg_path}")

logo_svg_path = os.path.join(PUBLIC_DIR, "logo.svg")
with open(logo_svg_path, "w") as f:
    f.write(LOGO_SVG.strip())
print(f"✓ Written {logo_svg_path}")

# 2. Render pixel-perfect raster images with Playwright
render_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ margin: 0; padding: 0; background: transparent; overflow: hidden; }}
  .box {{ display: flex; align-items: center; justify-content: center; }}
</style>
</head>
<body>
  <div id="icon" class="box" style="width: 512px; height: 512px;">
    {FAVICON_SVG.replace('width="64" height="64"', 'width="512" height="512"')}
  </div>
</body>
</html>"""

render_html_path = os.path.join(PUBLIC_DIR, "temp_render.html")
with open(render_html_path, "w") as f:
    f.write(render_html)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 600, "height": 600})
    page.goto(f"file://{render_html_path}")
    
    icon_elem = page.locator("#icon")
    
    # 512x512 logo.png
    logo_png_path = os.path.join(PUBLIC_DIR, "logo.png")
    icon_elem.screenshot(path=logo_png_path, omit_background=True)
    print(f"✓ Generated {logo_png_path} (512x512)")
    
    browser.close()

if os.path.exists(render_html_path):
    os.remove(render_html_path)

# 3. Use sips on macOS to resize logo.png into favicon.png (32x32) and apple-touch-icon.png (180x180)
fav_png_path = os.path.join(PUBLIC_DIR, "favicon.png")
apple_png_path = os.path.join(PUBLIC_DIR, "apple-touch-icon.png")

os.system(f'sips -z 32 32 "{logo_png_path}" --out "{fav_png_path}" > /dev/null')
print(f"✓ Generated {fav_png_path} (32x32)")

os.system(f'sips -z 180 180 "{logo_png_path}" --out "{apple_png_path}" > /dev/null')
print(f"✓ Generated {apple_png_path} (180x180)")

print("\n🎉 Brand assets successfully generated in apps/web/public!")
