#!/usr/bin/env python3
"""Builds the app pages from the canvas screens.

canvas/*.dc.html are exact copies of the boards in the Claude design canvas.
This script turns each one into a page of the app (index.html, story.html, ...):
it swaps the canvas runtime for app/support.js, points images at assets/,
links the screens to each other and refreshes the offline cache list in sw.js.

Run:  python3 build.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent

# canvas board -> app page
PAGES = {
    'Main': 'index',
    'TiradaLock': 'story',
    'FichaCarta': 'character',
    'Familiars': 'familiars',
}

# canvas asset id -> file in assets/
BLOBS = {
    'b6c60ccd20b4ce322455b33677d5bcce': 'morrigan_token.webp',
    '5b8946835e5469dddde954914a45798f': 'cackle.webm',
    '1bff2fc10252063d2ce12197169bf11d': 'morrigan_ink.webp',
    '986ef4ce4ae906f6680cdf460210d4d6': 'fam_owl.webp',
    '735c097268c39495e2f76c6aa143e1fd': 'fam_raven.webp',
    '0eb49a3d802a82178aa776116bdb8f44': 'fam_cat.webp',
    '12bf9af7c59614476de875e245fd089f': 'fam_octopus.webp',
    '61d1c3d44630b3ea93416294fe37bfe1': 'fam_spider.webp',
    '50f4731cd8c475641a3ae87810101d2b': 'card_wizard.jpg',
    '5a905bee0d496556d30371aa50a1f4ad': 'card_artifact.jpg',
    '671a30afe57cf7a4cd815523cede4742': 'card_merchant.jpg',
    '7ed027e4b352aaf3680a10502329560e': 'card_healer.jpg',
    'da6373b98c2ea208d8c89924cf941243': 'card_soldier.jpg',
}

HEAD = '''<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0A1119">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="stylesheet" href="app/app.css">
<script src="app/support.js"></script>'''


def build_page(board: str, page: str) -> None:
    src = (ROOT / 'canvas' / f'{board}.dc.html').read_text(encoding='utf-8')
    out = src.replace('<script src="./support.js"></script>', HEAD)
    out = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>\s*', '', out)
    out = re.sub(r'<title>.*?</title>', '<title>Morrigan</title>', out, count=1)
    # Keep the screen template inert until the runtime renders it (no stray requests).
    out = out.replace('<x-dc>', '<template id="dc-src">', 1).replace('</x-dc>', '</template>', 1)

    def blob(m):
        bid = m.group(1)
        if bid not in BLOBS:
            raise SystemExit(f'{board}: unknown asset /_blob/{bid}. Add it to BLOBS and assets/.')
        return 'assets/' + BLOBS[bid]
    out = re.sub(r'/_blob/([0-9a-f]+)', blob, out)

    for b, p in PAGES.items():
        out = out.replace(f'href="{b}.dc.html"', f'href="{p}.html"')
    leftover = re.findall(r'href="([^"]+\.dc\.html)"', out)
    if leftover:
        raise SystemExit(f'{board}: links to boards that are not in the app: {leftover}')
    (ROOT / f'{page}.html').write_text(out, encoding='utf-8')


def build_sw() -> None:
    files = [f'{p}.html' for p in PAGES.values()]
    files += ['manifest.webmanifest', 'app/app.css', 'app/support.js']
    for folder in ('app/fonts', 'assets', 'icons'):
        files += sorted(str(f.relative_to(ROOT)) for f in (ROOT / folder).iterdir() if f.is_file())
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode())
        h.update((ROOT / f).read_bytes())
    version = h.hexdigest()[:10]
    tpl = (ROOT / 'app' / 'sw.template.js').read_text(encoding='utf-8')
    sw = tpl.replace('__VERSION__', version).replace('__FILES__', json.dumps(['./'] + files, indent=2))
    (ROOT / 'sw.js').write_text(sw, encoding='utf-8')
    print('cache version', version, '-', len(files), 'files')


if __name__ == '__main__':
    for board, page in PAGES.items():
        build_page(board, page)
        print(f'{board}.dc.html -> {page}.html')
    build_sw()
