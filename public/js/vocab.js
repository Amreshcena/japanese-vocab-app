import {
  LS_VOCAB_PREFIX, lsGet, lsSet, lsRemove, updateCacheBadge,
  getCategories, addToCategory, removeFromCategory, getItemCategories
} from './cache.js';

// ==================== STATE ====================
export let VOCAB_LIST = [];
export let filteredList = [];
let currentPage = 1;
const PAGE_SIZE = 60;
let currentModalIndex = -1;
const meaningCache = new Map();
let vocabFilter = 'all';
let vocabCategoryFilter = null; // null = no category filter active

// ==================== FILTER ====================
export function setVocabFilter(f) {
  vocabFilter = f;
  ['all', 'studied', 'new'].forEach(id => {
    const el = document.getElementById('vf-' + id);
    el.className = 'filter-pill' + (id === f ? ` active-${id}` : '');
  });
  applyVocabFilter();
}

export function applyVocabFilter() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  let base = q
    ? VOCAB_LIST.filter(w => w.kanji.toLowerCase().includes(q) || w.reading.toLowerCase().includes(q))
    : [...VOCAB_LIST];
  if (vocabFilter === 'studied') base = base.filter(w => !!lsGet(LS_VOCAB_PREFIX, cacheKey(w)));
  else if (vocabFilter === 'new') base = base.filter(w => !lsGet(LS_VOCAB_PREFIX, cacheKey(w)));
  if (vocabCategoryFilter) {
    const cats = getCategories();
    const catKeys = (cats[vocabCategoryFilter] && cats[vocabCategoryFilter].vocab) || [];
    base = base.filter(w => catKeys.includes(cacheKey(w)));
  }
  filteredList = base;
  currentPage = 1;
  renderGrid();
}

export function setVocabCategoryFilter(catName) {
  vocabCategoryFilter = catName; // null clears, a name sets it
  applyVocabFilter();
}

export function renderVocabCategoryPills() {
  // Dropdown is rendered centrally by main.js — call safely even before __app is ready
  if (window.__app && typeof window.__app._renderCatDropdown === 'function') {
    window.__app._renderCatDropdown();
  }
}

export function renderHeaderCategoryPills() {
  renderVocabCategoryPills();
}

export function updateVocabStudiedCount() {
  const total = VOCAB_LIST.filter(w => !!lsGet(LS_VOCAB_PREFIX, cacheKey(w))).length;
  const el = document.getElementById('vStudiedCount');
  if (el) el.textContent = total ? `(${total})` : '';
}

// ==================== LOAD ====================
export async function loadVocabFromFile() {
  try {
    const response = await fetch('vocab.txt');
    const text = await response.text();
    VOCAB_LIST = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split('/');
        return { kanji: parts[0].trim(), reading: parts[1] ? parts[1].trim() : parts[0].trim() };
      });
    filteredList = [...VOCAB_LIST];
    document.getElementById('totalBadge').textContent = VOCAB_LIST.length.toLocaleString() + ' Words';
    updateVocabStudiedCount();
    renderGrid();
  } catch (e) {
    console.error('Failed to load vocab.txt:', e);
    document.getElementById('totalBadge').textContent = 'No vocab.txt';
  }
}

// ==================== GRID ====================
export function renderGrid() {
  const grid = document.getElementById('wordGrid');
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, filteredList.length);
  const slice = filteredList.slice(start, end);

  if (filteredList.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🔍</div><p>No words found.</p></div>`;
    updatePagination();
    return;
  }
  grid.innerHTML = slice.map((w, i) => {
    const globalIdx = start + i;
    const isCached = !!lsGet(LS_VOCAB_PREFIX, cacheKey(w));
    return `<div class="word-card" onclick="window.__vocab.openModal(${globalIdx})">
      <div class="word-number">#${globalIdx + 1}</div>
      <div class="word-kanji">${w.kanji}</div>
      <div class="word-reading">${w.reading}</div>
      <div class="card-hint" id="hint-${globalIdx}">${isCached ? '✅ Cached — instant load →' : '🔵 Click for English &amp; Tamil meaning →'}</div>
    </div>`;
  }).join('');
  updatePagination();
}

function updatePagination() {
  const total = filteredList.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  document.getElementById('paginationInfo').textContent =
    `Showing ${Math.min((currentPage - 1) * PAGE_SIZE + 1, total)}–${Math.min(currentPage * PAGE_SIZE, total)} of ${total}`;
  document.getElementById('pageNum').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevBtn').disabled = currentPage <= 1;
  document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

export function changePage(dir) {
  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
  renderGrid();
  window.scrollTo(0, 0);
}

export function clearSearch() {
  document.getElementById('searchInput').value = '';
  applyVocabFilter();
}

export function pickRandom() {
  openModal(Math.floor(Math.random() * filteredList.length));
}

// ==================== MODAL ====================
function cacheKey(w) { return `${w.kanji}|${w.reading}`; }

export async function openModal(globalIdx) {
  currentModalIndex = globalIdx;
  const word = filteredList[globalIdx];
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('modalContent');
  overlay.classList.add('active');
  updateNavButtons();

  const k = cacheKey(word);
  const delBtn = document.getElementById('deleteCacheBtn');
  if (delBtn) delBtn.style.display = (lsGet(LS_VOCAB_PREFIX, k) || meaningCache.get(k)) ? '' : 'none';

  const memCached = meaningCache.get(k);
  if (memCached && !(memCached instanceof Promise)) { displayResult(memCached, word); return; }

  const lsCached = lsGet(LS_VOCAB_PREFIX, k);
  if (lsCached) { meaningCache.set(k, lsCached); displayResult(lsCached, word); return; }

  content.innerHTML = `<div class="modal-word">${word.kanji}</div><div class="modal-reading">${word.reading}</div>
    <div class="loading-spinner"><span class="spinner"></span> Loading meanings…</div>`;

  try {
    let result;
    if (memCached instanceof Promise) {
      result = await memCached;
    } else {
      const p = fetchMeaning(word.kanji, word.reading).then(r => {
        meaningCache.set(k, r);
        lsSet(LS_VOCAB_PREFIX, k, r);
        updateCacheBadge();
        updateVocabStudiedCount();
        const db = document.getElementById('deleteCacheBtn');
        if (db) db.style.display = '';
        return r;
      });
      meaningCache.set(k, p);
      result = await p;
    }
    if (currentModalIndex === globalIdx) displayResult(result, word);
  } catch (e) {
    if (currentModalIndex === globalIdx)
      content.innerHTML += `<p style="color:var(--accent);margin-top:12px">Error loading. Please try again.</p>`;
  }
}

export function deleteCurrentVocabCache() {
  if (currentModalIndex < 0) return;
  const word = filteredList[currentModalIndex];
  const k = cacheKey(word);
  lsRemove(LS_VOCAB_PREFIX, k);
  meaningCache.delete(k);
  document.getElementById('deleteCacheBtn').style.display = 'none';
  const hintEl = document.getElementById(`hint-${currentModalIndex}`);
  if (hintEl) { hintEl.textContent = '🔵 Click for English & Tamil meaning →'; hintEl.style.color = ''; }
  updateCacheBadge();
  updateVocabStudiedCount();
  if (vocabFilter === 'studied') applyVocabFilter();
}

async function fetchMeaning(kanji, reading) {
  const prompt = `Japanese teacher for Tamil students. Word: ${kanji}（${reading}）
Return ONLY JSON (no markdown, no extra text):
{"word_type":"noun/verb/adj/adv/expr","meanings":[{"number":1,"english":"meaning","tamil":"தமிழ் அர்த்தம்","examples":[{"jp":"sentence 1","en":"English 1","ta":"Tamil 1"},{"jp":"sentence 2","en":"English 2","ta":"Tamil 2"}]}],"ctx":{"area_en":"field/domain","area_ta":"துறை","time_en":"when used","time_ta":"எப்போது","place_en":"where used","place_ta":"எங்கே"}}
Add more meaning objects only for truly distinct meanings. Each meaning must have exactly 2 examples. Keep all values brief.`;

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
      const content = document.getElementById('modalContent');
      if (content) {
        let remaining = waitSec;
        const interval = setInterval(() => {
          const el = content.querySelector('.loading-spinner');
          if (el) el.innerHTML = `<span class="spinner"></span> Rate limited. Retrying in ${remaining}s…`;
          remaining--;
          if (remaining < 0) clearInterval(interval);
        }, 1000);
      }
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }
    if (data.error) throw new Error(data.error);
    return JSON.parse(data.text.replace(/```json|```/g, '').trim());
  }
  throw new Error('Max retries reached.');
}

function displayResult(r, word) {
  const content = document.getElementById('modalContent');
  const meanings = r.meanings || [];
  const meaningsHtml = meanings.map((m, i) => {
    const num = meanings.length > 1 ? `<span class="meaning-num">${m.number || i + 1}</span>` : '';
    const examples = m.examples || [];
    const exHtml = examples.map(ex => `
      <div class="example-jp">🇯🇵 ${ex.jp}</div>
      <div class="example-en">🇬🇧 ${ex.en}</div>
      <div class="example-ta">🇮🇳 ${ex.ta}</div>
    `).join('<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">');
    return `<div class="meaning-block">
      <div class="meaning-row">${num}<div class="meaning-texts">
        <div class="meaning-en">🇬🇧 ${m.english}</div>
        <div class="meaning-ta">🇮🇳 ${m.tamil}</div>
      </div></div>
      <div class="example-block">
        <div class="example-label">📝 உதாரணம்</div>
        ${exHtml}
      </div>
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="modal-word">${word.kanji}</div>
    <div class="modal-reading">${word.reading}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="tag">🏷️ ${r.word_type || 'word'}</span>
      <span class="tag">#${currentModalIndex + 1} of ${filteredList.length}</span>
      <span class="tag" style="background:var(--accent3)">${meanings.length} meaning${meanings.length > 1 ? 's' : ''}</span>
    </div>
    <div class="section">
      <div class="section-label">📘 Meanings &amp; Examples (பொருள் மற்றும் உதாரணங்கள்)</div>
      <div class="meanings-container">${meaningsHtml}</div>
    </div>
    ${r.ctx ? `<div class="section">
      <div class="section-label">📍 எங்கே, எப்போது பயன்படுத்துவது? (Usage Context)</div>
      <div class="section-content usage-context">
        <div class="usage-row"><span class="usage-icon">🏢</span><div class="usage-content">
          <span class="usage-label">Areas / துறை &amp; சூழல்</span>
          <div class="usage-value-en">${r.ctx.area_en || '—'}</div>
          <div class="usage-value-ta">${r.ctx.area_ta || '—'}</div>
        </div></div>
        <div class="usage-row"><span class="usage-icon">🕐</span><div class="usage-content">
          <span class="usage-label">Time / நேரம் &amp; சந்தர்ப்பம்</span>
          <div class="usage-value-en">${r.ctx.time_en || '—'}</div>
          <div class="usage-value-ta">${r.ctx.time_ta || '—'}</div>
        </div></div>
        <div class="usage-row"><span class="usage-icon">📍</span><div class="usage-content">
          <span class="usage-label">Place / இடம்</span>
          <div class="usage-value-en">${r.ctx.place_en || '—'}</div>
          <div class="usage-value-ta">${r.ctx.place_ta || '—'}</div>
        </div></div>
      </div>
    </div>` : ''}`;
  // Append category section
  content.innerHTML += buildVocabCatUI(cacheKey(word));
}

function buildVocabCatUI(key) {
  const cats = getCategories();
  const allNames = Object.keys(cats);
  const myCategories = getItemCategories('vocab', key);
  const safeId = key.replace(/[^a-zA-Z0-9]/g, '_');

  const tagsHtml = myCategories.length
    ? myCategories.map(n =>
      `<span class="cat-tag">${n}
          <button onclick="__vocab.removeCatItem('${key.replace(/'/g, "\\'")}','${n.replace(/'/g, "\\'")}')">✕</button>
        </span>`
    ).join('')
    : '<span class="cat-empty">Not in any category</span>';

  const optionsHtml = allNames.length
    ? allNames.map(n => `<option value="${n}">${n}</option>`).join('')
    : '<option value="" disabled>No categories yet</option>';

  return `<div class="cat-section">
    <div class="section-label">🏷️ My Categories</div>
    <div class="cat-tags" id="vcat-tags-${safeId}">${tagsHtml}</div>
    <div class="cat-add-row">
      <select id="vcat-select-${safeId}">${optionsHtml}</select>
      <button class="btn green" style="padding:4px 10px;font-size:.8rem"
        onclick="__vocab.addCatItem('${key.replace(/'/g, "\\'")}','vcat-select-${safeId}','vcat-tags-${safeId}')">+ Add</button>
      <button class="btn secondary" style="padding:4px 10px;font-size:.8rem"
        onclick="__app.openCatManager()">⚙ Manage</button>
    </div>
    <div class="cat-new-row">
      <input type="text" id="vcat-new-${safeId}" placeholder="New category name…" class="cat-new-input">
      <button class="btn secondary" style="padding:4px 10px;font-size:.8rem"
        onclick="__vocab.createCatItem('${key.replace(/'/g, "\\'")}','vcat-new-${safeId}','vcat-select-${safeId}','vcat-tags-${safeId}')">Create &amp; Add</button>
    </div>
  </div>`;
}

export function addCatItem(key, selectId, tagsId) {
  const sel = document.getElementById(selectId);
  if (!sel || !sel.value) return;
  addToCategory('vocab', key, sel.value);
  _refreshVocabCatTags(key, tagsId);
  renderVocabCategoryPills();
}

export function removeCatItem(key, catName) {
  removeFromCategory('vocab', key, catName);
  const safeId = key.replace(/[^a-zA-Z0-9]/g, '_');
  _refreshVocabCatTags(key, `vcat-tags-${safeId}`);
  renderVocabCategoryPills();
}

export function createCatItem(key, inputId, selectId, tagsId) {
  const inp = document.getElementById(inputId);
  const name = inp ? inp.value.trim() : '';
  if (!name) return;
  addToCategory('vocab', key, name);
  if (inp) inp.value = '';
  // refresh select options
  const sel = document.getElementById(selectId);
  if (sel) {
    const cats = getCategories();
    sel.innerHTML = Object.keys(cats).map(n => `<option value="${n}">${n}</option>`).join('');
  }
  _refreshVocabCatTags(key, tagsId);
  renderVocabCategoryPills();
}

function _refreshVocabCatTags(key, tagsId) {
  const el = document.getElementById(tagsId);
  if (!el) return;
  const myCategories = getItemCategories('vocab', key);
  el.innerHTML = myCategories.length
    ? myCategories.map(n =>
      `<span class="cat-tag">${n}
          <button onclick="__vocab.removeCatItem('${key.replace(/'/g, "\\'")}','${n.replace(/'/g, "\\'")}')">✕</button>
        </span>`
    ).join('')
    : '<span class="cat-empty">Not in any category</span>';
}

export function closeModal() {
  document.getElementById('overlay').classList.remove('active');
  currentModalIndex = -1;
}

export function navigateWord(dir) {
  const newIdx = currentModalIndex + dir;
  if (newIdx >= 0 && newIdx < filteredList.length) openModal(newIdx);
}

function updateNavButtons() {
  document.getElementById('prevWord').disabled = currentModalIndex <= 0;
  document.getElementById('nextWord').disabled = currentModalIndex >= filteredList.length - 1;
}
