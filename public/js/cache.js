// ==================== PERSISTENT CACHE (localStorage) ====================
export const LS_VOCAB_PREFIX = 'jpvocab_v1_';
export const LS_GRAMMAR_PREFIX = 'jpgrammar_v1_';
export const LS_CATEGORIES_KEY = 'jp_categories_v1';

export function lsGet(prefix, key) {
  try {
    const raw = localStorage.getItem(prefix + btoa(unescape(encodeURIComponent(key))));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function lsSet(prefix, key, value) {
  try {
    localStorage.setItem(prefix + btoa(unescape(encodeURIComponent(key))), JSON.stringify(value));
  } catch (e) {
    // Storage full — evict oldest 20 entries
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.slice(0, 20).forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(prefix + btoa(unescape(encodeURIComponent(key))), JSON.stringify(value));
    } catch (_) { }
  }
}

export function lsRemove(prefix, key) {
  try { localStorage.removeItem(prefix + btoa(unescape(encodeURIComponent(key)))); } catch (e) { }
}

export function getCacheStats() {
  const vCount = Object.keys(localStorage).filter(k => k.startsWith(LS_VOCAB_PREFIX)).length;
  const gCount = Object.keys(localStorage).filter(k => k.startsWith(LS_GRAMMAR_PREFIX)).length;
  return { vocab: vCount, grammar: gCount };
}

export function updateCacheBadge() {
  const s = getCacheStats();
  const el = document.getElementById('cacheStatus');
  if (el) el.textContent = `💾 ${s.vocab}V + ${s.grammar}G cached`;
}

export function clearAllCache(onDone) {
  if (!confirm('Clear all cached vocab & grammar data?\nThis cannot be undone.')) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_VOCAB_PREFIX) || k.startsWith(LS_GRAMMAR_PREFIX))
    .forEach(k => localStorage.removeItem(k));
  updateCacheBadge();
  if (onDone) onDone();
}

export function exportCache() {
  const data = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_VOCAB_PREFIX) || k.startsWith(LS_GRAMMAR_PREFIX) || k === LS_CATEGORIES_KEY)
    .forEach(k => { data[k] = localStorage.getItem(k); });
  const count = Object.keys(data).length;
  if (count === 0) { alert('No cached data to export.'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jp_study_cache_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importCache(event, onDone) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      let imported = 0;
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith(LS_VOCAB_PREFIX) || k.startsWith(LS_GRAMMAR_PREFIX) || k === LS_CATEGORIES_KEY) {
          localStorage.setItem(k, v);
          imported++;
        }
      });
      updateCacheBadge();
      alert(`✅ Imported ${imported} cached entries!`);
      if (onDone) onDone();
    } catch (err) { alert('Failed to import: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ==================== CATEGORIES ====================
// Shape: { "MyList": { vocab: ["食べる|たべる", ...], grammar: ["てform", ...] }, ... }

export function getCategories() {
  try {
    return JSON.parse(localStorage.getItem(LS_CATEGORIES_KEY) || '{}');
  } catch (e) { return {}; }
}

export function saveCategories(cats) {
  try { localStorage.setItem(LS_CATEGORIES_KEY, JSON.stringify(cats)); } catch (e) { }
}

export function addToCategory(type, key, categoryName) {
  const cats = getCategories();
  if (!cats[categoryName]) cats[categoryName] = { vocab: [], grammar: [] };
  if (!cats[categoryName][type]) cats[categoryName][type] = [];
  if (!cats[categoryName][type].includes(key)) cats[categoryName][type].push(key);
  saveCategories(cats);
}

export function removeFromCategory(type, key, categoryName) {
  const cats = getCategories();
  if (!cats[categoryName] || !cats[categoryName][type]) return;
  cats[categoryName][type] = cats[categoryName][type].filter(k => k !== key);
  saveCategories(cats);
}

export function deleteCategory(name) {
  const cats = getCategories();
  delete cats[name];
  saveCategories(cats);
}

export function renameCategory(oldName, newName) {
  const cats = getCategories();
  if (!cats[oldName] || cats[newName]) return false;
  cats[newName] = cats[oldName];
  delete cats[oldName];
  saveCategories(cats);
  return true;
}

export function getItemCategories(type, key) {
  const cats = getCategories();
  return Object.entries(cats)
    .filter(([, v]) => v[type] && v[type].includes(key))
    .map(([name]) => name);
}
