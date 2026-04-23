import {
  updateCacheBadge, clearAllCache, exportCache, importCache,
  getCategories, deleteCategory, renameCategory
} from './cache.js';
import {
  loadVocabFromFile, renderGrid, applyVocabFilter, setVocabFilter,
  updateVocabStudiedCount, changePage, clearSearch, pickRandom,
  openModal, closeModal, navigateWord, deleteCurrentVocabCache,
  renderVocabCategoryPills, setVocabCategoryFilter,
  addCatItem as vocabAddCat, removeCatItem as vocabRemoveCat, createCatItem as vocabCreateCat
} from './vocab.js';
import {
  loadGrammarFromFile, renderGrammarGrid, applyGrammarFilter, setGrammarFilter,
  updateGrammarStudiedCount, changeGrammarPage, clearGrammarSearch, pickRandomGrammar,
  openGrammarModal, closeGrammarModal, navigateGrammar, deleteCurrentGrammarCache,
  renderGrammarCategoryPills, setGrammarCategoryFilter,
  addCatItem as grammarAddCat, removeCatItem as grammarRemoveCat, createCatItem as grammarCreateCat
} from './grammar.js';

// ==================== TAB SWITCHING ====================
let activeTab = 'vocab';

function switchTab(tab) {
  activeTab = tab;
  document.getElementById('panelVocab').classList.toggle('active', tab === 'vocab');
  document.getElementById('panelGrammar').classList.toggle('active', tab === 'grammar');
  document.getElementById('tabVocab').classList.toggle('active', tab === 'vocab');
  document.getElementById('tabVocab').classList.remove('grammar');
  document.getElementById('tabGrammar').classList.toggle('active', tab === 'grammar');
  if (tab === 'grammar') {
    document.getElementById('tabGrammar').classList.add('grammar');
    loadGrammarFromFile();
  }
}

// ==================== CATEGORY DROPDOWN ====================
let catDropdownOpen = false;
let activeCatFilter = null;

function renderCatDropdown() {
  const btn = document.getElementById('catDropdownBtn');
  const label = document.getElementById('catDropdownLabel');
  const clearBtn = document.getElementById('catDdClearBtn');
  if (!btn) return;
  const cats = getCategories();
  const count = Object.keys(cats).length;
  if (count === 0) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  if (activeCatFilter) {
    label.textContent = activeCatFilter;
    btn.classList.add('cat-dd-active');
    if (clearBtn) clearBtn.style.display = '';
  } else {
    label.textContent = 'Categories';
    btn.classList.remove('cat-dd-active');
    if (clearBtn) clearBtn.style.display = 'none';
  }
  renderCatDropdownList();
}

function renderCatDropdownList(query) {
  const list = document.getElementById('catDdList');
  if (!list) return;
  const cats = getCategories();
  const q = (query || '').toLowerCase().trim();
  const names = Object.keys(cats).filter(n => !q || n.toLowerCase().includes(q));
  if (names.length === 0) {
    list.innerHTML = `<div class="cat-dd-empty">No categories found</div>`;
    return;
  }
  list.innerHTML = names.map(n => {
    const vCount = (cats[n].vocab || []).length;
    const gCount = (cats[n].grammar || []).length;
    const isActive = activeCatFilter === n;
    const safe = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<div class="cat-dd-item${isActive ? ' active' : ''}" onclick="__app.selectCatFilter('${safe}')">
      <span class="cat-dd-name">🏷️ ${n}</span>
      <span class="cat-dd-counts">${vCount}V · ${gCount}G</span>
    </div>`;
  }).join('');
}

function toggleCatDropdown() {
  const panel = document.getElementById('catDropdownPanel');
  const btn = document.getElementById('catDropdownBtn');
  if (!panel || !btn) return;
  catDropdownOpen = !catDropdownOpen;
  if (catDropdownOpen) {
    // Position panel below the button using fixed coords (escapes overflow:hidden header)
    const rect = btn.getBoundingClientRect();
    panel.style.top = (rect.bottom + 6) + 'px';
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.display = '';
    const arrow = btn.querySelector('.cat-dd-arrow');
    if (arrow) arrow.textContent = '▴';
    const inp = document.getElementById('catDdSearch');
    if (inp) { inp.value = ''; inp.focus(); }
    renderCatDropdownList();
  } else {
    panel.style.display = 'none';
    const arrow = btn.querySelector('.cat-dd-arrow');
    if (arrow) arrow.textContent = '▾';
  }
}

function closeCatDropdown() {
  if (!catDropdownOpen) return;
  catDropdownOpen = false;
  const panel = document.getElementById('catDropdownPanel');
  if (panel) panel.style.display = 'none';
  const arrow = document.getElementById('catDropdownBtn')?.querySelector('.cat-dd-arrow');
  if (arrow) arrow.textContent = '▾';
}

function selectCatFilter(name) {
  activeCatFilter = (activeCatFilter === name) ? null : name;
  setVocabCategoryFilter(activeCatFilter);
  setGrammarCategoryFilter(activeCatFilter);
  renderCatDropdown();
  closeCatDropdown();
}

function clearCatFilter() {
  activeCatFilter = null;
  setVocabCategoryFilter(null);
  setGrammarCategoryFilter(null);
  renderCatDropdown();
}

document.addEventListener('click', e => {
  if (catDropdownOpen) {
    const wrap = document.getElementById('catDropdownWrap');
    if (wrap && !wrap.contains(e.target)) closeCatDropdown();
  }
});

// ==================== CATEGORY MANAGER ====================
function openCatManager() {
  const cats = getCategories();
  const names = Object.keys(cats);
  const modal = document.getElementById('catManagerModal');
  const content = document.getElementById('catManagerContent');
  if (names.length === 0) {
    content.innerHTML = `<p class="cat-empty" style="text-align:center;padding:20px">
      No categories yet. Open any word or grammar point and create one.</p>`;
  } else {
    content.innerHTML = names.map(name => {
      const vCount = (cats[name].vocab || []).length;
      const gCount = (cats[name].grammar || []).length;
      const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<div class="cat-manager-row">
        <div class="cat-manager-info">
          <span class="cat-manager-name">🏷️ ${name}</span>
          <span class="cat-manager-count">${vCount} vocab · ${gCount} grammar</span>
        </div>
        <div class="cat-manager-actions">
          <button class="btn secondary" style="padding:3px 8px;font-size:.75rem"
            onclick="__app.renameCat('${safeName}')">✏️ Rename</button>
          <button class="btn" style="padding:3px 8px;font-size:.75rem;background:#7f1d1d"
            onclick="__app.deleteCat('${safeName}')">🗑 Delete</button>
        </div>
      </div>`;
    }).join('');
  }
  modal.classList.add('active');
}

// ==================== KEYBOARD NAV ====================
document.addEventListener('keydown', e => {
  if (document.getElementById('overlay').classList.contains('active')) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') navigateWord(1);
    if (e.key === 'ArrowLeft') navigateWord(-1);
  }
  if (document.getElementById('grammarOverlay').classList.contains('active')) {
    if (e.key === 'Escape') closeGrammarModal();
    if (e.key === 'ArrowRight') navigateGrammar(1);
    if (e.key === 'ArrowLeft') navigateGrammar(-1);
  }
  if (catDropdownOpen && e.key === 'Escape') closeCatDropdown();
});

// ==================== EXPOSE TO HTML ====================
window.__vocab = {
  openModal, closeModal, navigateWord, deleteCurrentVocabCache,
  changePage, clearSearch, pickRandom, setVocabFilter,
  handleSearch: () => applyVocabFilter(),
  handleOverlayClick: (e) => { if (e.target === document.getElementById('overlay')) closeModal(); },
  setVocabCategoryFilter,
  addCatItem: vocabAddCat,
  removeCatItem: vocabRemoveCat,
  createCatItem: vocabCreateCat
};

window.__grammar = {
  openGrammarModal, closeGrammarModal, navigateGrammar, deleteCurrentGrammarCache,
  changeGrammarPage, clearGrammarSearch, pickRandomGrammar, setGrammarFilter,
  handleGrammarSearch: () => applyGrammarFilter(),
  handleGrammarOverlayClick: (e) => { if (e.target === document.getElementById('grammarOverlay')) closeGrammarModal(); },
  setGrammarCategoryFilter,
  addCatItem: grammarAddCat,
  removeCatItem: grammarRemoveCat,
  createCatItem: grammarCreateCat
};

window.__app = {
  switchTab,
  exportCache,
  openCatManager,
  _renderCatDropdown: renderCatDropdown,
  closeCatManager: () => document.getElementById('catManagerModal').classList.remove('active'),
  toggleCatDropdown,
  closeCatDropdown,
  filterCatDropdown: () => renderCatDropdownList(document.getElementById('catDdSearch')?.value || ''),
  selectCatFilter,
  clearCatFilter,
  renameCat: (name) => {
    const newName = prompt(`Rename "${name}" to:`, name);
    if (!newName || newName.trim() === name) return;
    if (!renameCategory(name, newName.trim())) { alert('A category with that name already exists.'); return; }
    if (activeCatFilter === name) activeCatFilter = newName.trim();
    renderCatDropdown();
    openCatManager();
  },
  deleteCat: (name) => {
    if (!confirm(`Delete category "${name}"?\n(Words won't be deleted, just uncategorized.)`)) return;
    deleteCategory(name);
    if (activeCatFilter === name) {
      activeCatFilter = null;
      setVocabCategoryFilter(null);
      setGrammarCategoryFilter(null);
    }
    renderCatDropdown();
    openCatManager();
  },
  clearAllCache: () => clearAllCache(() => {
    updateVocabStudiedCount();
    updateGrammarStudiedCount();
    renderGrid();
    renderGrammarGrid();
  }),
  importCache: (event) => importCache(event, () => {
    updateVocabStudiedCount();
    updateGrammarStudiedCount();
    renderGrid();
    renderGrammarGrid();
    renderCatDropdown();
  })
};

// ==================== INIT ====================
loadVocabFromFile();
updateCacheBadge();
renderCatDropdown();
