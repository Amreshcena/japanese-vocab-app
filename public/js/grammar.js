import {
  LS_GRAMMAR_PREFIX, lsGet, lsSet, lsRemove, updateCacheBadge,
  getCategories, addToCategory, removeFromCategory, getItemCategories
} from './cache.js';

// ==================== STATE ====================
let GRAMMAR_LIST = [];
let filteredGrammarList = [];
let grammarPage = 1;
const GRAMMAR_PAGE_SIZE = 80;
let currentGrammarModalIndex = -1;
const grammarCache = new Map();
let grammarFilter = 'all';
let grammarCategoryFilter = null; // null = no category filter active

// ==================== FILTER ====================
export function setGrammarFilter(f) {
  grammarFilter = f;
  ['all', 'studied', 'new'].forEach(id => {
    const el = document.getElementById('gf-' + id);
    el.className = 'filter-pill grammar-pill' + (id === f ? ` active-${id}` : '');
  });
  applyGrammarFilter();
}

export function applyGrammarFilter() {
  const q = document.getElementById('grammarSearchInput').value.trim().toLowerCase();
  let base = q ? GRAMMAR_LIST.filter(g => g.toLowerCase().includes(q)) : [...GRAMMAR_LIST];
  if (grammarFilter === 'studied') base = base.filter(g => !!lsGet(LS_GRAMMAR_PREFIX, g));
  else if (grammarFilter === 'new') base = base.filter(g => !lsGet(LS_GRAMMAR_PREFIX, g));
  if (grammarCategoryFilter) {
    const cats = getCategories();
    const catKeys = (cats[grammarCategoryFilter] && cats[grammarCategoryFilter].grammar) || [];
    base = base.filter(g => catKeys.includes(g));
  }
  filteredGrammarList = base;
  grammarPage = 1;
  renderGrammarGrid();
}

export function setGrammarCategoryFilter(catName) {
  grammarCategoryFilter = catName; // null clears, a name sets it
  applyGrammarFilter();
}

export function renderGrammarCategoryPills() {
  if (window.__app && window.__app._renderCatDropdown) window.__app._renderCatDropdown();
}

export function updateGrammarStudiedCount() {
  const total = GRAMMAR_LIST.filter(g => !!lsGet(LS_GRAMMAR_PREFIX, g)).length;
  const el = document.getElementById('gStudiedCount');
  if (el) el.textContent = total ? `(${total})` : '';
}

// ==================== LOAD ====================
export async function loadGrammarFromFile() {
  try {
    const response = await fetch('bunpro_grammar_all_levels.txt');
    const text = await response.text();
    GRAMMAR_LIST = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    filteredGrammarList = [...GRAMMAR_LIST];
    const badge = document.getElementById('grammarBadge');
    badge.style.display = '';
    badge.textContent = GRAMMAR_LIST.length + ' Grammar Points';
    updateGrammarStudiedCount();
    renderGrammarGrid();
  } catch (e) {
    console.error('Failed to load grammar file:', e);
    document.getElementById('grammarGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1"><div class="big">❌</div><p>Could not load grammar file.</p></div>`;
  }
}

// ==================== GRID ====================
export function renderGrammarGrid() {
  const grid = document.getElementById('grammarGrid');
  const start = (grammarPage - 1) * GRAMMAR_PAGE_SIZE;
  const end = Math.min(start + GRAMMAR_PAGE_SIZE, filteredGrammarList.length);
  const slice = filteredGrammarList.slice(start, end);

  if (filteredGrammarList.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🔍</div><p>No grammar points found.</p></div>`;
    updateGrammarPagination();
    return;
  }
  grid.innerHTML = slice.map((g, i) => {
    const globalIdx = start + i;
    const isCached = (grammarCache.has(g) && !(grammarCache.get(g) instanceof Promise)) || !!lsGet(LS_GRAMMAR_PREFIX, g);
    return `<div class="grammar-card" onclick="window.__grammar.openGrammarModal(${globalIdx})">
      <div class="grammar-num">#${globalIdx + 1}</div>
      <div class="grammar-point">${g}</div>
      <div class="grammar-hint" id="ghint-${globalIdx}">${isCached ? '✅ Click to view instantly →' : '🟣 Click for full grammar details →'}</div>
    </div>`;
  }).join('');
  updateGrammarPagination();
}

function updateGrammarPagination() {
  const total = filteredGrammarList.length;
  const totalPages = Math.ceil(total / GRAMMAR_PAGE_SIZE) || 1;
  document.getElementById('grammarPaginationInfo').textContent =
    `Showing ${Math.min((grammarPage - 1) * GRAMMAR_PAGE_SIZE + 1, total)}–${Math.min(grammarPage * GRAMMAR_PAGE_SIZE, total)} of ${total}`;
  document.getElementById('grammarPageNum').textContent = `Page ${grammarPage} of ${totalPages}`;
  document.getElementById('grammarPrevBtn').disabled = grammarPage <= 1;
  document.getElementById('grammarNextBtn').disabled = grammarPage >= totalPages;
}

export function changeGrammarPage(dir) {
  const totalPages = Math.ceil(filteredGrammarList.length / GRAMMAR_PAGE_SIZE);
  grammarPage = Math.max(1, Math.min(totalPages, grammarPage + dir));
  renderGrammarGrid();
  window.scrollTo(0, 0);
}

export function clearGrammarSearch() {
  document.getElementById('grammarSearchInput').value = '';
  applyGrammarFilter();
}

export function pickRandomGrammar() {
  openGrammarModal(Math.floor(Math.random() * filteredGrammarList.length));
}

// ==================== MODAL ====================
export async function openGrammarModal(globalIdx) {
  currentGrammarModalIndex = globalIdx;
  const point = filteredGrammarList[globalIdx];
  const overlay = document.getElementById('grammarOverlay');
  const content = document.getElementById('grammarModalContent');
  overlay.classList.add('active');
  updateGrammarNavButtons();

  const delBtn = document.getElementById('deleteGrammarCacheBtn');
  if (delBtn) delBtn.style.display = (lsGet(LS_GRAMMAR_PREFIX, point) || (grammarCache.has(point) && !(grammarCache.get(point) instanceof Promise))) ? '' : 'none';

  const memCached = grammarCache.get(point);
  if (memCached && !(memCached instanceof Promise)) { displayGrammarResult(memCached, point, globalIdx); return; }

  const lsCached = lsGet(LS_GRAMMAR_PREFIX, point);
  if (lsCached) { grammarCache.set(point, lsCached); displayGrammarResult(lsCached, point, globalIdx); return; }

  content.innerHTML = `
    <div class="grammar-title">${point}</div>
    <div class="grammar-subtitle">BunPro Grammar Point #${globalIdx + 1}</div>
    <div class="loading-spinner"><span class="spinner purple-spin"></span> Loading grammar details…</div>`;

  try {
    let result;
    if (memCached instanceof Promise) {
      result = await memCached;
    } else {
      const p = fetchGrammarDetails(point).then(r => {
        grammarCache.set(point, r);
        lsSet(LS_GRAMMAR_PREFIX, point, r);
        updateCacheBadge();
        updateGrammarStudiedCount();
        const db = document.getElementById('deleteGrammarCacheBtn');
        if (db) db.style.display = '';
        return r;
      });
      grammarCache.set(point, p);
      result = await p;
    }
    if (currentGrammarModalIndex === globalIdx) displayGrammarResult(result, point, globalIdx);
  } catch (e) {
    if (currentGrammarModalIndex === globalIdx)
      content.innerHTML += `<p style="color:var(--accent);margin-top:12px">Error loading. Please try again.</p>`;
  }
}

export function deleteCurrentGrammarCache() {
  if (currentGrammarModalIndex < 0) return;
  const point = filteredGrammarList[currentGrammarModalIndex];
  lsRemove(LS_GRAMMAR_PREFIX, point);
  grammarCache.delete(point);
  document.getElementById('deleteGrammarCacheBtn').style.display = 'none';
  const hintEl = document.getElementById(`ghint-${currentGrammarModalIndex}`);
  if (hintEl) { hintEl.textContent = '🟣 Click for full grammar details →'; hintEl.style.color = ''; }
  updateCacheBadge();
  updateGrammarStudiedCount();
  if (grammarFilter === 'studied') applyGrammarFilter();
}

async function fetchGrammarDetails(grammarPoint) {
  const prompt = `You are a Japanese grammar expert teaching Tamil-speaking students.

Grammar point: 「${grammarPoint}」

Return ONLY valid JSON, no markdown, no extra text.

Each meaning must contain: its own English+Tamil meaning, its own register tags, its own formation structures, and its own example sentences.

{
  "grammar_point": "${grammarPoint}",
  "meanings": [
    {
      "number": 1,
      "english": "Clear English meaning for this specific use",
      "tamil": "தமிழில் பொருள்",
      "register": ["casual", "spoken"],
      "structures": [
        {
          "rule": "Verb stem + そう",
          "transforms": [
            { "before": "食べ(る)", "after": "食べそう", "gloss": "looks like will eat" }
          ]
        }
      ],
      "examples": [
        { "jp": "雨が降りそうだ。", "en": "It looks like it's going to rain.", "ta": "மழை வருவது போல் தெரிகிறது." }
      ]
    }
  ]
}

IMPORTANT RULES:
- Generate the CORRECT structures for 「${grammarPoint}」
- register per meaning: pick only applicable tags from: casual, formal, written, spoken, polite, literary, neutral
- If grammar has ONE meaning → 5 examples in that meaning
- If grammar has MULTIPLE genuinely different meanings → 2 examples per meaning
- Do NOT add any fields outside this schema`;

  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    const is429 = response.status === 429 || (data.error && data.error.includes('429'));
    const is503 = response.status === 503 || (data.error && (data.error.includes('503') || data.error.includes('UNAVAILABLE')));
    if (is429 || is503) {
      const waitMatch = data.error && data.error.match(/retry in ([\d.]+)s/i);
      const waitSec = is429 ? (waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 2 : 45) : 10;
      const content = document.getElementById('grammarModalContent');
      if (content) {
        let remaining = waitSec;
        const interval = setInterval(() => {
          const el = content.querySelector('.loading-spinner');
          if (el) el.innerHTML = `<span class="spinner purple-spin"></span> Rate limited. Retrying in ${remaining}s…`;
          remaining--;
          if (remaining < 0) clearInterval(interval);
        }, 1000);
      }
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }
    if (data.error) throw new Error(data.error);
    let text = data.text.replace(/```json|```/g, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) text = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(text);
  }
  throw new Error('Max retries reached.');
}

function displayGrammarResult(r, point, globalIdx) {
  const content = document.getElementById('grammarModalContent');
  const meanings = r.meanings || [];
  const regLabels = {
    casual: '💬 Casual', formal: '🎩 Formal', written: '✍️ Written',
    spoken: '🗣️ Spoken', polite: '🙏 Polite', literary: '📜 Literary', neutral: '⚖️ Neutral'
  };

  const blocksHtml = meanings.map((m, i) => {
    const isMulti = meanings.length > 1;
    const meanHeader = `<div class="meaning-texts" style="margin-bottom:10px">
      ${isMulti ? `<div style="font-size:0.7rem;color:var(--purple);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Meaning ${m.number || i + 1}</div>` : ''}
      <div class="meaning-en" style="font-size:1.05rem">🇬🇧 ${m.english}</div>
      <div class="meaning-ta" style="font-size:0.95rem;margin-top:4px">🇮🇳 ${m.tamil}</div>
    </div>`;

    const regs = m.register || [];
    const registerHtml = regs.length > 0 ? `<div class="register-badges" style="margin-bottom:14px">
      ${regs.map(reg => `<span class="register-tag ${reg}">${regLabels[reg] || reg}</span>`).join('')}
    </div>` : '';

    const structs = m.structures || [];
    let structBodyHtml = '';
    structs.forEach(s => {
      structBodyHtml += `<div class="rule-line">${s.rule}</div>`;
      (s.transforms || []).forEach(t => {
        structBodyHtml += `<div class="transform-line">　${t.before} <span class="arrow">→</span> <span class="result">${t.after}</span>　<span class="gloss">(${t.gloss})</span></div>`;
      });
      structBodyHtml += `<div style="height:4px"></div>`;
    });
    const structHtml = structs.length > 0 ? `
      <div class="section-label" style="margin-bottom:6px">📐 Structure (அமைப்பு)</div>
      <div class="structure-code-wrap" style="margin-bottom:14px">
        <div class="structure-code-header">Formation Rules</div>
        <div class="structure-code-body">${structBodyHtml}</div>
      </div>` : '';

    const exs = m.examples || [];
    const exHtml = exs.length > 0 ? `
      <div class="section-label" style="margin-bottom:6px">📝 உதாரணங்கள் (Examples)</div>
      <div class="examples-table-wrap" style="margin-bottom:4px">
        <table class="examples-table">
          <thead><tr><th>🇯🇵 Japanese</th><th>🇬🇧 English</th><th>🇮🇳 Tamil</th></tr></thead>
          <tbody>${exs.map(ex => `<tr>
            <td class="td-jp">${ex.jp}</td>
            <td class="td-en">${ex.en}</td>
            <td class="td-ta">${ex.ta}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : '';

    return `<div class="grammar-meaning-block" style="padding:16px;margin-bottom:${isMulti ? '16px' : '0'}">
      ${meanHeader}${registerHtml}${structHtml}${exHtml}
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="grammar-title">${point}</div>
    <div class="grammar-subtitle">BunPro Grammar Point #${globalIdx + 1} of ${filteredGrammarList.length}</div>
    <div class="meanings-container" style="margin-top:16px">${blocksHtml}</div>`;

  // Append category section
  content.innerHTML += buildGrammarCatUI(point);

  const hintEl = document.getElementById(`ghint-${globalIdx}`);
  if (hintEl) { hintEl.textContent = '✅ Click to view instantly →'; hintEl.style.color = 'var(--green)'; }
}

function buildGrammarCatUI(key) {
  const cats = getCategories();
  const allNames = Object.keys(cats);
  const myCategories = getItemCategories('grammar', key);
  const safeId = key.replace(/[^a-zA-Z0-9]/g, '_');

  const tagsHtml = myCategories.length
    ? myCategories.map(n =>
      `<span class="cat-tag">${n}
          <button onclick="__grammar.removeCatItem('${key.replace(/'/g, "\\'")}','${n.replace(/'/g, "\\'")}')">✕</button>
        </span>`
    ).join('')
    : '<span class="cat-empty">Not in any category</span>';

  const optionsHtml = allNames.length
    ? allNames.map(n => `<option value="${n}">${n}</option>`).join('')
    : '<option value="" disabled>No categories yet</option>';

  return `<div class="cat-section">
    <div class="section-label">🏷️ My Categories</div>
    <div class="cat-tags" id="gcat-tags-${safeId}">${tagsHtml}</div>
    <div class="cat-add-row">
      <select id="gcat-select-${safeId}">${optionsHtml}</select>
      <button class="btn purple" style="padding:4px 10px;font-size:.8rem"
        onclick="__grammar.addCatItem('${key.replace(/'/g, "\\'")}','gcat-select-${safeId}','gcat-tags-${safeId}')">+ Add</button>
      <button class="btn secondary" style="padding:4px 10px;font-size:.8rem"
        onclick="__app.openCatManager()">⚙ Manage</button>
    </div>
    <div class="cat-new-row">
      <input type="text" id="gcat-new-${safeId}" placeholder="New category name…" class="cat-new-input">
      <button class="btn secondary" style="padding:4px 10px;font-size:.8rem"
        onclick="__grammar.createCatItem('${key.replace(/'/g, "\\'")}','gcat-new-${safeId}','gcat-select-${safeId}','gcat-tags-${safeId}')">Create &amp; Add</button>
    </div>
  </div>`;
}

export function addCatItem(key, selectId, tagsId) {
  const sel = document.getElementById(selectId);
  if (!sel || !sel.value) return;
  addToCategory('grammar', key, sel.value);
  _refreshGrammarCatTags(key, tagsId);
  renderGrammarCategoryPills();
}

export function removeCatItem(key, catName) {
  removeFromCategory('grammar', key, catName);
  const safeId = key.replace(/[^a-zA-Z0-9]/g, '_');
  _refreshGrammarCatTags(key, `gcat-tags-${safeId}`);
  renderGrammarCategoryPills();
}

export function createCatItem(key, inputId, selectId, tagsId) {
  const inp = document.getElementById(inputId);
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  addToCategory('grammar', key, name);
  if (inp) inp.value = '';
  const sel = document.getElementById(selectId);
  if (sel) {
    const cats = getCategories();
    sel.innerHTML = Object.keys(cats).map(n => `<option value="${n}">${n}</option>`).join('');
  }
  _refreshGrammarCatTags(key, tagsId);
  renderGrammarCategoryPills();
}

function _refreshGrammarCatTags(key, tagsId) {
  const el = document.getElementById(tagsId);
  if (!el) return;
  const myCategories = getItemCategories('grammar', key);
  el.innerHTML = myCategories.length
    ? myCategories.map(n =>
      `<span class="cat-tag">${n}
          <button onclick="__grammar.removeCatItem('${key.replace(/'/g, "\\'")}','${n.replace(/'/g, "\\'")}')">✕</button>
        </span>`
    ).join('')
    : '<span class="cat-empty">Not in any category</span>';
}

export function closeGrammarModal() {
  document.getElementById('grammarOverlay').classList.remove('active');
  currentGrammarModalIndex = -1;
}

export function navigateGrammar(dir) {
  const newIdx = currentGrammarModalIndex + dir;
  if (newIdx >= 0 && newIdx < filteredGrammarList.length) openGrammarModal(newIdx);
}

function updateGrammarNavButtons() {
  document.getElementById('prevGrammar').disabled = currentGrammarModalIndex <= 0;
  document.getElementById('nextGrammar').disabled = currentGrammarModalIndex >= filteredGrammarList.length - 1;
}
