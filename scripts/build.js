/**
 * build.js
 * Scans notes/ recursively, compiles .typ → PDF, generates manifest.json.
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

/** Recursively find all .typ files, returning paths relative to NOTES_DIR */
function findTypFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...findTypFiles(full));
    } else if (e.name.endsWith('.typ')) {
      results.push(path.relative(NOTES_DIR, full));
    }
  }
  return results.sort();
}

function compileNote(relPath) {
  const typPath = path.join(NOTES_DIR, relPath);
  const parsed = path.parse(relPath);
  // id = dir/subdir/name (without .typ)
  const id = path.join(parsed.dir, parsed.name);
  const outDir = path.join(COMPILED_DIR, id);
  fs.mkdirSync(outDir, { recursive: true });

  const content = fs.readFileSync(typPath, 'utf-8');
  const title = parseTitle(content) || parsed.name.replace(/[-_]/g, ' ');
  const pdfPath = path.join(outDir, 'doc.pdf');

  log(`  ${relPath} → PDF`);

  const ok = shell(`${typstBin()} compile "${typPath}" "${pdfPath}"`);
  if (ok === null || !fs.existsSync(pdfPath)) {
    log(`    ❌ compilation failed`);
    return null;
  }

  const pages = shell(`pdfinfo "${pdfPath}" 2>/dev/null | grep "^Pages:" | awk '{print $2}'`);
  const pageCount = pages ? parseInt(pages, 10) : 1;
  log(`    ✓ ${pageCount} page${pageCount !== 1 ? 's' : ''}`);

  return { id, title, path: `notes/${relPath}`, pages: pageCount };
}

function main() {
  log('Starting build…\n');
  fs.mkdirSync(COMPILED_DIR, { recursive: true });

  const files = findTypFiles(NOTES_DIR);
  if (files.length === 0) log('WARNING: No .typ files found');

  const manifest = [];
  for (const rel of files) {
    const entry = compileNote(rel);
    if (entry) manifest.push(entry);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  log(`\n✓ Manifest: ${MANIFEST_PATH} (${manifest.length} notes)`);
}

main();
