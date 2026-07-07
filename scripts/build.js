/**
 * build.js
 * Compiles .typ → PDF → HTML via pdftohtml.
 * Final HTML has fully selectable text, zero plugins.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NOTES_DIR = path.join(ROOT, 'notes');
const COMPILED_DIR = path.join(ROOT, 'assets', 'compiled');
const MANIFEST_PATH = path.join(NOTES_DIR, 'manifest.json');

function log(msg) { console.log(`[build] ${msg}`); }

function shell(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 30000 }).toString().trim();
  } catch (e) {
    const s = e.stderr?.toString().trim();
    if (s) log(`   ${s}`);
    return null;
  }
}

function typstBin() {
  const snap = '/snap/bin/typst';
  return fs.existsSync(snap) ? snap : 'typst';
}

function parseTitle(content) {
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^=+ (.+)/);
    if (m) return m[1].trim();
  }
  return null;
}

/** Find .typ files recursively */
function findTypFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...findTypFiles(full));
    else if (e.name.endsWith('.typ')) results.push(path.relative(NOTES_DIR, full));
  }
  return results.sort();
}

/** Map pdftohtml's PDF-internal font names to web-safe families */
function mapFonts(css) {
  return css
    .replace(/font-family:[A-Za-z0-9+]+\+LibertinusSerif/gi, 'font-family:serif')
    .replace(/font-family:[A-Za-z0-9+]+\+LibertinusSans/gi, 'font-family:sans-serif')
    .replace(/font-family:[A-Za-z0-9+]+\+DejaVuSansMono/gi, 'font-family:monospace')
    .replace(/font-family:[A-Za-z0-9+]+\+NewCMMath[^;]+/gi, 'font-family:serif')
    .replace(/font-family:[A-Za-z0-9+]+\+InriaSerif/gi, 'font-family:serif')
    .replace(/font-family:[A-Za-z0-9+]+\+InriaSans/gi, 'font-family:sans-serif');
}

/** Clean pdftohtml output: remove background images, fix fonts, remove body bgcolor */
function cleanHtml(raw, pageCount) {
  let html = raw;

  // Remove background images
  html = html.replace(/<img[^>]*alt="background image"[^>]*\/>\s*/g, '');

  // Remove body bgcolor
  html = html.replace(/bgcolor="[^"]*"/g, '');

  // Remove Document Outline section (before </body>)
  html = html.replace(/<hr\/>[^]*?(?=<\/body>)/i, '');

  // Map fonts in the <style> block
  html = html.replace(/(<style[^>]*>)(.*?)(<\/style>)/gs, (_, open, css, close) => {
    return open + mapFonts(css) + close;
  });

  // Get the content between <body> and </body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : '';

  // Wrap each page div in a container
  const pages = body.split(/(?=<div id="page\d+-div")/);
  
  const styled = pages.map((page, i) => {
    if (!page.trim()) return '';
    // Wrap page in a container
    return `<div class="note-page">${page}</div>`;
  }).join('\n');

  return styled;
}

function compileNote(relPath) {
  const typPath = path.join(NOTES_DIR, relPath);
  const parsed = path.parse(relPath);
  const id = path.join(parsed.dir, parsed.name);
  const outDir = path.join(COMPILED_DIR, id);
  fs.mkdirSync(outDir, { recursive: true });

  const content = fs.readFileSync(typPath, 'utf-8');
  const title = parseTitle(content) || parsed.name.replace(/[-_]/g, ' ');

  log(`  ${relPath} → PDF`);

  // Step 1: compile to PDF
  const pdfPath = path.join(outDir, 'doc.pdf');
  const pdfOk = shell(`${typstBin()} compile "${typPath}" "${pdfPath}"`);
  if (pdfOk === null || !fs.existsSync(pdfPath)) {
    log(`    ❌ PDF compilation failed`);
    return null;
  }

  // Step 2: PDF → HTML via pdftohtml
  const htmlBase = path.join(outDir, 'page');
  const htmlOk = shell(`pdftohtml -c -s -noframes "${pdfPath}" "${htmlBase}"`);
  
  // pdftohtml outputs "Page-1\nPage-2" etc to stderr
  // The HTML file is at {htmlBase}.html
  const htmlPath = htmlBase + '.html';
  if (htmlOk === null || !fs.existsSync(htmlPath)) {
    log(`    ❌ pdftohtml failed`);
    return null;
  }

  // Step 3: clean and post-process
  const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
  const count = (rawHtml.match(/id="page\d+-div"/g) || []).length;
  const cleaned = cleanHtml(rawHtml, count);

  // Step 4: save as index.html in output dir
  fs.writeFileSync(path.join(outDir, 'index.html'), cleaned, 'utf-8');

  // Clean up temp files
  try { fs.unlinkSync(pdfPath); } catch {}
  try { fs.unlinkSync(htmlPath); } catch {}
  // Remove pdftohtml-generated PNGs
  const pngs = fs.readdirSync(outDir).filter(f => f.endsWith('.png'));
  for (const p of pngs) try { fs.unlinkSync(path.join(outDir, p)); } catch {}

  log(`    ✓ ${count} page${count !== 1 ? 's' : ''}`);
  return { id, title, path: `notes/${relPath}`, pages: count };
}

function main() {
  log('Starting build…\n');
  fs.mkdirSync(COMPILED_DIR, { recursive: true });

  const files = findTypFiles(NOTES_DIR);
  const manifest = [];

  for (const rel of files) {
    const entry = compileNote(rel);
    if (entry) manifest.push(entry);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  log(`\n✓ Manifest: ${MANIFEST_PATH} (${manifest.length} notes)`);
}

main();
