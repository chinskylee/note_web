/**
 * Notes App — Pre-compiled HTML viewer
 *
 * .typ → PDF → HTML (via pdftohtml) at build time.
 * Fully selectable text, zero plugins, works on all devices.
 */

const state = { notes: [], activeId: null };

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const noteList  = $('#note-list');
const output    = $('#typst-output');
const reader    = $('#reader');
const sidebar   = $('#sidebar');
const toggleBtn = $('#sidebar-toggle');
const collapseBtn = $('#sidebar-collapse');
const expandBtn = $('#sidebar-expand');
const themeBtn  = $('#theme-toggle');
const homeLink  = $('#home-link');
const overlay   = $('#loading-overlay');

// ── Theme ──
function getPreferredTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('note-web-theme', t); } catch {}
}
const savedTheme = (() => { try { return localStorage.getItem('note-web-theme'); } catch {} })();
setTheme(savedTheme || getPreferredTheme());
themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!savedTheme) setTheme(e.matches ? 'dark' : 'light');
});

// ── Sidebar collapse ──
let sidebarCollapsed = (() => { try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch {} })();
function applySidebarState() {
  document.documentElement.classList.toggle('sidebar-hidden', sidebarCollapsed);
}
applySidebarState();
collapseBtn?.addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  try { localStorage.setItem('sidebar-collapsed', sidebarCollapsed); } catch {}
  applySidebarState();
});
expandBtn?.addEventListener('click', () => {
  sidebarCollapsed = false;
  try { localStorage.setItem('sidebar-collapsed', 'false'); } catch {}
  applySidebarState();
});

// ── Manifest ──
async function loadManifest() {
  const r = await fetch('notes/manifest.json');
  if (!r.ok) throw new Error('Failed to load manifest');
  return r.json();
}

// ── Tree builder ──
function buildTree(entries) {
  const root = { type: 'folder', name: '', children: [] };
  for (const e of entries) {
    const parts = e.id.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find(c => c.type === 'folder' && c.name === parts[i]);
      if (!child) {
        child = { type: 'folder', name: parts[i], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ type: 'file', name: e.title, id: e.id, title: e.title, pages: e.pages });
  }
  function sortChildren(n) {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(c => { if (c.type === 'folder') sortChildren(c); });
  }
  sortChildren(root);
  return root.children;
}

// ── Render tree ──
function renderTree(tree) {
  noteList.innerHTML = '';
  let folderState = (() => { try { return JSON.parse(localStorage.getItem('tree-folders') || '{}'); } catch {} })() || {};

  function createFolderEl(folder, depth) {
    const open = folderState[folder.name] !== false;
    const li = document.createElement('li');
    li.className = 'tree-folder';
    const label = document.createElement('div');
    label.className = 'tree-folder-label';
    label.style.paddingLeft = `${12 + depth * 16}px`;
    label.innerHTML = `
      <svg class="folder-chevron ${open ? 'open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="tree-folder-name">${escHtml(folder.name)}</span>`;
    label.addEventListener('click', () => {
      const ul = li.querySelector('.tree-children');
      const chevron = label.querySelector('.folder-chevron');
      const isOpen = ul.style.display !== 'none';
      ul.style.display = isOpen ? 'none' : '';
      chevron.classList.toggle('open', !isOpen);
      folderState[folder.name] = !isOpen;
      try { localStorage.setItem('tree-folders', JSON.stringify(folderState)); } catch {}
    });
    li.appendChild(label);
    const ul = document.createElement('ul');
    ul.className = 'tree-children';
    ul.style.display = open ? '' : 'none';
    folder.children.forEach(c => {
      if (c.type === 'folder') ul.appendChild(createFolderEl(c, depth + 1));
      else ul.appendChild(createFileEl(c, depth + 1));
    });
    li.appendChild(ul);
    return li;
  }

  function createFileEl(file, depth) {
    const li = document.createElement('li');
    li.className = `note-item${file.id === state.activeId ? ' active' : ''}`;
    li.dataset.id = file.id;
    li.style.paddingLeft = `${12 + depth * 16}px`;
    li.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="title">${escHtml(file.title)}</span>
      ${file.pages > 1 ? `<span class="badge">${file.pages}p</span>` : ''}`;
    li.addEventListener('click', () => navigateTo(file.id));
    return li;
  }

  tree.forEach(node => {
    if (node.type === 'folder') noteList.appendChild(createFolderEl(node, 0));
    else noteList.appendChild(createFileEl(node, 0));
  });
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s; return d.innerHTML;
}

// ── Navigation ──
async function navigateTo(id) {
  if (id === state.activeId) return;
  state.activeId = id;
  reader.classList.add('note-mode');
  highlightActive(id);

  output.innerHTML = `<div class="typst-loading"><div class="spinner"></div><p>Loading…</p></div>`;

  try {
    const resp = await fetch(`assets/compiled/${id}/index.html`);
    if (!resp.ok) throw new Error('Failed to load note');
    const html = await resp.text();
    output.innerHTML = `<div class="note-render fade-in">${html}</div>`;
    scalePages();
    history.replaceState(null, '', `#${id}`);
  } catch (err) {
    output.innerHTML = `<div class="typst-error fade-in"><h3>Failed to load note</h3><p>${err.message}</p></div>`;
  }

  sidebar.classList.remove('open');
}

function navigateHome() {
  state.activeId = null;
  reader.classList.remove('note-mode');
  history.replaceState(null, '', window.location.pathname);
  highlightActive(null);
  output.innerHTML = `
    <div class="home-hero fade-in">
      <h1>Welcome to Notes</h1>
      <p>Your personal knowledge base, written in Typst &amp; rendered beautifully.</p>
    </div>`;
  sidebar.classList.remove('open');
}

function highlightActive(id) {
  $$('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

// ── Scale pages to fit viewport ──
function scalePages() {
  const containers = output.querySelectorAll('.note-page div[style*="position:relative"]');
  containers.forEach(container => {
    // Extract original width from style
    const match = container.getAttribute('style').match(/width:(\d+)px/);
    if (!match) return;
    const origW = parseInt(match[1], 10);
    // The container's parent (.note-page) has max-width: 820px
    // Calculate scale to fit
    const parentW = container.parentElement.offsetWidth;
    if (parentW > 0 && parentW < origW) {
      const scale = parentW / origW;
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top left';
      container.style.height = `${container.offsetHeight * scale}px`;
    }
  });
}

// Resize handler
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(scalePages, 200);
});

// ── Hash routing ──
function handleHash() {
  const hash = window.location.hash.slice(1);
  if (hash && state.notes.some(n => n.id === hash)) navigateTo(hash);
}

// ── Bootstrap ──
async function bootstrap() {
  try {
    state.notes = await loadManifest();
    const tree = buildTree(state.notes);
    renderTree(tree);
    overlay.classList.add('hidden');
    handleHash();
    if (!window.location.hash.slice(1)) navigateHome();
  } catch (err) {
    overlay.innerHTML = `<div style="text-align:center;max-width:400px"><h3>Failed to load</h3><p style="color:var(--text-secondary)">${err.message}</p></div>`;
  }
}

// ── Events ──
homeLink.addEventListener('click', e => { e.preventDefault(); navigateHome(); });
toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') sidebar.classList.remove('open');
});
window.addEventListener('hashchange', handleHash);

bootstrap();
