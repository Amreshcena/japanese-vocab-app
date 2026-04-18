import { updateCacheBadge, clearAllCache, exportCache, importCache } from './cache.js';
import {
  loadVocabFromFile, renderGrid, applyVocabFilter, setVocabFilter,
  updateVocabStudiedCount, changePage, clearSearch, pickRandom,
  openModal, closeModal, navigateWord, deleteCurrentVocabCache
} from './vocab.js';
import {
  loadGrammarFromFile, renderGrammarGrid, applyGrammarFilter, setGrammarFilter,
  updateGrammarStudiedCount, changeGrammarPage, clearGrammarSearch, pickRandomGrammar,
  openGrammarModal, closeGrammarModal, navigateGrammar, deleteCurrentGrammarCache
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

// ==================== KEYBOARD NAV ====================
document.addEventListener('keydown', e => {
  if (document.getElementById('overlay').classList.contains('active')) {
    if (e.key === 'Escape')      closeModal();
    if (e.key === 'ArrowRight')  navigateWord(1);
    if (e.key === 'ArrowLeft')   navigateWord(-1);
  }
  if (document.getElementById('grammarOverlay').classList.contains('active')) {
    if (e.key === 'Escape')      closeGrammarModal();
    if (e.key === 'ArrowRight')  navigateGrammar(1);
    if (e.key === 'ArrowLeft')   navigateGrammar(-1);
  }
});

// ==================== EXPOSE TO HTML ====================
// Since we use ES modules, onclick="" attributes need access to these functions.
// We expose them on window namespaces to avoid polluting window directly.
window.__vocab = {
  openModal, closeModal, navigateWord, deleteCurrentVocabCache,
  changePage, clearSearch, pickRandom, setVocabFilter,
  handleSearch: () => applyVocabFilter(),
  handleOverlayClick: (e) => { if (e.target === document.getElementById('overlay')) closeModal(); }
};

window.__grammar = {
  openGrammarModal, closeGrammarModal, navigateGrammar, deleteCurrentGrammarCache,
  changeGrammarPage, clearGrammarSearch, pickRandomGrammar, setGrammarFilter,
  handleGrammarSearch: () => applyGrammarFilter(),
  handleGrammarOverlayClick: (e) => { if (e.target === document.getElementById('grammarOverlay')) closeGrammarModal(); }
};

window.__app = {
  switchTab,
  exportCache,
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
  })
};

// ==================== INIT ====================
loadVocabFromFile();
updateCacheBadge();
