// ============================================================
// Character Management
// ============================================================

function renderCharTabs() {
  const el = document.getElementById('charTabs');
  const list = getCharList();
  let html = '<label>キャラ:</label>';
  list.forEach(id => {
    const data = loadCharData(id);
    const info = getCharInfo(id);
    const label = data?.charName || info?.name || id;
    const active = id === currentCharId ? ' active' : '';
    html += `<button class="char-tab${active}" onclick="switchChar('${esc(id)}')">${esc(label)}</button>`;
  });
  html += `<button class="char-tab-add" onclick="addNewChar()">+ 追加</button>`;
  if (list.length > 1) {
    html += `<button class="sm danger" onclick="deleteChar()" style="margin-left:auto;font-size:0.72em">削除</button>`;
  }
  el.innerHTML = html;
}

async function switchChar(id) {
  saveAll();
  currentCharId = id;
  localStorage.setItem(LASTCHAR_KEY, id);
  selectedId = null;
  fileExistence = {};
  await load();
  renderCharTabs();
  renderList();
  updateCounts();
  showEmpty();
  checkAllFiles();
  if (projectDirHandle) {
    await scanAssetFiles(id);
    renderAssetSyncStatus();
  }
}

async function addNewChar() {
  const id = prompt('新キャラのID (英字小文字)', '');
  if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) {
    if (id !== null) toast('IDは英字小文字で入力してください', 'err');
    return;
  }
  const list = getCharList();
  if (list.includes(id)) { toast('このIDは既に存在します', 'err'); return; }
  list.push(id);
  saveCharList(list);
  saveAll();
  currentCharId = id;
  localStorage.setItem(LASTCHAR_KEY, id);
  items = getDefaults().map(makeItem);
  selectedId = null;
  fileExistence = {};
  saveAll();
  renderCharTabs();
  renderList();
  updateCounts();
  showEmpty();
  const info = getCharInfo(id);
  const msg = info
    ? `「${id}」を追加（ゲームコードから${info.cgEvents.length}件のCG検出）`
    : `「${id}」を追加しました`;
  toast(msg, 'ok');
  checkAllFiles();
}

function deleteChar() {
  const list = getCharList();
  if (list.length <= 1) { toast('最後のキャラは削除できません', 'err'); return; }
  if (!confirm(`「${currentCharId}」を削除しますか？`)) return;
  localStorage.removeItem(STORAGE_PREFIX + currentCharId);
  const newList = list.filter(id => id !== currentCharId);
  saveCharList(newList);
  switchChar(newList[0]);
  toast('削除しました', 'ok');
}
