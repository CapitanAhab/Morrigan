#!/usr/bin/env node
/* Builds the app pages from the canvas screens.

   canvas/*.dc.html are exact copies of the boards in the Claude design canvas.
   This script turns each one into a page of the app (index.html, story.html, ...):
   it swaps the canvas runtime for app/support.js, points images at assets/,
   links the screens to each other and refreshes the offline cache list in sw.js.

   Run:    npm run build
   Check:  npm run check   (fails if the generated files are out of date; used by the pre-push hook)
*/
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// canvas board -> app page
const PAGES = {
  Main: 'index',
  TiradaLock: 'story',
  FichaCarta: 'character',
  Familiars: 'familiars',
};

// canvas asset id -> file in assets/
const BLOBS = {
  b6c60ccd20b4ce322455b33677d5bcce: 'morrigan_token.webp',
  '5b8946835e5469dddde954914a45798f': 'response.wav',
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
  da6373b98c2ea208d8c89924cf941243: 'card_soldier.jpg',
};

const HEAD = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0A1119">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="stylesheet" href="app/app.css">
<script src="app/support.js"></script>`;

const fail = (msg) => { console.error(msg); process.exit(1); };
// Text is always handled with LF endings, so the output (and the cache version) is the same on any machine.
const readText = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const lit = (s) => () => s; // literal replacement (no $-patterns)

function buildPage(board) {
  let out = readText(`canvas/${board}.dc.html`);
  out = out.replace('<script src="./support.js"></script>', lit(HEAD));
  out = out.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '');
  out = out.replace(/<title>.*?<\/title>/, lit('<title>Morrigan</title>'));
  // Keep the screen template inert until the runtime renders it (no stray requests).
  out = out.replace('<x-dc>', lit('<template id="dc-src">')).replace('</x-dc>', lit('</template>'));

  out = out.replace(/\/_blob\/([0-9a-f]+)/g, (_, id) => {
    if (!(id in BLOBS)) fail(`${board}: unknown asset /_blob/${id}. Add it to BLOBS and assets/.`);
    return 'assets/' + BLOBS[id];
  });

  for (const [b, p] of Object.entries(PAGES)) out = out.split(`href="${b}.dc.html"`).join(`href="${p}.html"`);
  const leftover = [...out.matchAll(/href="([^"]+\.dc\.html)"/g)].map((m) => m[1]);
  if (leftover.length) fail(`${board}: links to boards that are not in the app: ${JSON.stringify(leftover)}`);
  return out;
}

function listFolder(folder) {
  return readdirSync(join(ROOT, folder))
    .filter((f) => statSync(join(ROOT, folder, f)).isFile())
    .map((f) => `${folder}/${f}`)
    .sort();
}

function isText(rel) { return /\.(html|js|css|json|webmanifest|md|svg|txt)$/i.test(rel); }

function buildSw(pages) {
  let files = Object.values(PAGES).map((p) => `${p}.html`);
  files.push('manifest.webmanifest', 'app/app.css', 'app/support.js');
  for (const folder of ['app/fonts', 'assets', 'icons']) files = files.concat(listFolder(folder));
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f, 'utf8');
    // Pages are hashed as they are about to be written, not as they are on disk.
    if (f in pages) h.update(pages[f], 'utf8');
    else if (isText(f)) h.update(readText(f), 'utf8');
    else h.update(readFileSync(join(ROOT, f)));
  }
  const version = h.digest('hex').slice(0, 10);
  const sw = readText('app/sw.template.js')
    .replace('__VERSION__', lit(version))
    .replace('__FILES__', lit(JSON.stringify(['./', ...files], null, 2)));
  return { sw, version, count: files.length };
}

const check = process.argv.includes('--check');
const outputs = {};
for (const [board, page] of Object.entries(PAGES)) outputs[`${page}.html`] = buildPage(board);
const { sw, version, count } = buildSw(outputs);
outputs['sw.js'] = sw;

// www/: the copy of the app that goes inside the APK (npx cap sync). Not in the repo.
function buildWww(pages) {
  const WWW = join(ROOT, 'www');
  rmSync(WWW, { recursive: true, force: true });
  mkdirSync(WWW);
  for (const dir of ['app', 'assets', 'icons']) cpSync(join(ROOT, dir), join(WWW, dir), { recursive: true });
  cpSync(join(ROOT, 'manifest.webmanifest'), join(WWW, 'manifest.webmanifest'));
  for (const [f, text] of Object.entries(pages)) writeFileSync(join(WWW, f), text, 'utf8');
}

if (check) {
  const stale = Object.keys(outputs).filter((f) => !existsSync(join(ROOT, f)) || readText(f) !== outputs[f]);
  if (stale.length) fail(`Out of date: ${stale.join(', ')}. Run: npm run build`);
  console.log('build is up to date (cache version', version + ')');
} else {
  for (const [f, text] of Object.entries(outputs)) writeFileSync(join(ROOT, f), text, 'utf8');
  for (const [board, page] of Object.entries(PAGES)) console.log(`${board}.dc.html -> ${page}.html`);
  console.log('cache version', version, '-', count, 'files');
  const pages = Object.fromEntries(Object.values(PAGES).map((p) => [`${p}.html`, outputs[`${p}.html`]]));
  buildWww(pages);
  console.log('www/ for the APK');
}
