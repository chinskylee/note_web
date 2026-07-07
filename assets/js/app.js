/**
 * Notes App — Tree file browser + PDF viewer
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

// ── Sidebar collapse (desktop) ──
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

// ── Manifest ──
async function loadManifest() {
  const r = await fetch('notes/manifest.json');
  if (!r.ok) throw new Error('Failed to load manifest');
  return r.json();
}

// ── Tree builder ──
/**
 * Convert flat manifest entries into a nested tree.
 * Returns: [ TreeNode, … ]
 * TreeNode = { type:'folder', name, children:[TreeNode] }
 *          | { type:'file', id, title, pages }
 */
function buildTree(entries) {
  const root = { type: 'folder', name: '', children: [] };

  for (const e of entries) {
    const parts = e.id.split('/');
    let node = root;

    // Walk/create folder chain
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find(c => c.type === 'folder' && c.name === parts[i]);
      if (!child) {
        child = { type: 'folder', name: parts[i], children: [] };
        node.children.push(child);
      }
      node = child;
    }

    // Add file leaf
    node.children.push({
      type: 'file',
      name: e.title,
      id: e.id,
      title: e.title,
      pages: e.pages,
    });
  }

  // Sort: folders first, then files, alphabetically
  function sortChildren(node) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(c => { if (c.type === 'folder') sortChildren(c); });
  }
  sortChildren(root);

  return root.children;
}

// ── Render tree ──
function renderTree(tree) {
  noteList.innerHTML = '';
  let folderState = (() => { try { return JSON.parse(localStorage.getItem('tree-folders') || '{}'); } catch {} })() || {};

  function createFolderEl(folder, depth) {
    const id = folder.name;
    const open = folderState[id] !== false;
    const li = document.createElement('li');
    li.className = 'tree-folder';
    li.dataset.depth = depth;

    const label = document.createElement('div');
    label.className = 'tree-folder-label';
    label.style.paddingLeft = `${12 + depth * 16}px`;
    label.innerHTML = `
      <svg class="folder-chevron ${open ? 'open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="tree-folder-name">${escHtml(folder.name)}</span>
    `;
    label.addEventListener('click', () => {
      const ul = li.querySelector('.tree-children');
      const chevron = label.querySelector('.folder-chevron');
      const isOpen = ul.style.display !== 'none';
      ul.style.display = isOpen ? 'none' : '';
      chevron.classList.toggle('open', !isOpen);
      folderState[id] = !isOpen;
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
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span class="title">${escHtml(file.title)}</span>
      ${file.pages > 1 ? `<span class="badge">${file.pages}p</span>` : ''}
    `;
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
function navigateTo(id) {
  if (id === state.activeId) return;
  state.activeId = id;
  reader.classList.add('pdf-mode');
  output.innerHTML = `<div class="typst-loading"><div class="spinner"></div><p>Loading…</p></div>`;
  const pdfUrl = `assets/compiled/${id}/doc.pdf`;
  output.innerHTML = `<div class="pdf-viewer fade-in">
    <iframe src="${encodeURI(pdfUrl)}#view=FitH" class="pdf-embed" title="PDF viewer"></iframe>
    <div class="pdf-bar">
      <a href="${encodeURI(pdfUrl)}" class="pdf-open-btn" target="_blank">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Open PDF
      </a>
    </div>
  </div>`;
  history.replaceState(null, '', `#${id}`);
  sidebar.classList.remove('open');
  highlightActive(id);
}

function navigateHome() {
  state.activeId = null;
  reader.classList.remove('pdf-mode');
  history.replaceState(null, '', window.location.pathname);
  output.innerHTML = `
    <div class="home-hero fade-in">
      <h1>Welcome to Notes</h1>
      <p>Your personal knowledge base, written in Typst &amp; rendered beautifully.</p>
    </div>`;
  sidebar.classList.remove('open');
  highlightActive(null);
}

function highlightActive(id) {
  $$('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

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
    overlay.innerHTML = `<div style="text-align:center;max-width:400px"><div style="font-size:2rem;opacity:0.5">⚠️</div><h3>Failed to load</h3><p style="color:var(--text-secondary);font-size:0.9rem">${err.message}</p></div>`;
  }
}

// ── Events ──
homeLink.addEventListener('click', e => { e.preventDefault(); navigateHome(); });
toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
expandBtn?.addEventListener('click', () => {
  sidebarCollapsed = false;
  try { localStorage.setItem('sidebar-collapsed', 'false'); } catch {}
  applySidebarState();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') sidebar.classList.remove('open');
});
window.addEventListener('hashchange', handleHash);

bootstrap();
