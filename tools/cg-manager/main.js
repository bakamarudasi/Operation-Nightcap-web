// ============================================================
// Init & Keyboard Shortcuts
// ============================================================

async function init() {
  // Migrate from old pipeline storage
  const oldRaw = localStorage.getItem('nightcap_cg_pipeline_v2');
  if (oldRaw) {
    try {
      const d = JSON.parse(oldRaw);
      const charId = d.charId || 'blaze';
      if (!localStorage.getItem(STORAGE_PREFIX + charId)) {
        localStorage.setItem(STORAGE_PREFIX + charId, oldRaw);
      }
      const list = getCharList();
      if (!list.includes(charId)) { list.push(charId); saveCharList(list); }
      localStorage.removeItem('nightcap_cg_pipeline_v2');
    } catch {}
  }

  const lastChar = localStorage.getItem(LASTCHAR_KEY);
  const charList = getCharList();
  if (lastChar && charList.includes(lastChar)) currentCharId = lastChar;
  else currentCharId = charList[0] || 'blaze';

  await fetchGameData();

  if (charDataCache) {
    const charList2 = getCharList();
    let changed = false;
    for (const id of Object.keys(charDataCache)) {
      if (!charList2.includes(id)) { charList2.push(id); changed = true; }
    }
    if (changed) saveCharList(charList2);
  }

  await load();
  renderCharTabs();
  renderList();
  updateCounts();
  checkAllFiles();
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (gpState) closeGamePreview();
    const cmpOverlay = document.getElementById('compareOverlay');
    if (cmpOverlay && cmpOverlay.style.display !== 'none' && cmpOverlay.style.display !== '') closeCompareView();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    undo();
  }
});

// Setup drag & drop and paste handlers
setupDragDrop();
setupPaste();

// Start the app
init();
