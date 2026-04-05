// ============================================================
// Item CRUD & Detail Panel
// ============================================================

function addItem(type) {
  const id = type + '_' + Date.now();
  const file = type === 'cg' ? 'new_cg.webp' : type === 'portrait' ? 'portrait-new.webp' : 'new-icon.webp';
  const trigger = '新規' + (type === 'cg' ? 'CG' : type === 'portrait' ? '立ち絵' : 'アイコン');
  items.push(makeItem({ id, file, trigger, level: '', type, note: '' }));
  saveAll(); renderList(); updateCounts();
  selectItem(id);
}

function removeItem(id) {
  if (!confirm('削除しますか？')) return;
  items = items.filter(i => i.id !== id);
  if (selectedId === id) { selectedId = null; showEmpty(); }
  saveAll(); renderList(); updateCounts();
}

// ============================================================
// Selection & Detail
// ============================================================

function selectItem(id) {
  selectedId = id;
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';

  document.getElementById('dFile').value = item.file;
  document.getElementById('dTrigger').value = item.trigger;
  document.getElementById('dLevel').value = item.level || '';
  document.getElementById('dNote').value = item.note || '';
  updateFileStatus(item);
  renderFeedback(item);
  renderPreview(item);
  renderHistory(item);
  document.getElementById('reviewBtns').style.display =
    (item.status === 'review' || item.history.length > 0) ? 'flex' : 'none';
  document.getElementById('previewBtn').style.display = item.type === 'cg' ? 'inline-block' : 'none';

  const isCG = item.type === 'cg';
  document.getElementById('eventPropsPanel').style.display = isCG ? 'block' : 'none';
  document.getElementById('codeGenPanel').style.display = isCG ? 'block' : 'none';
  if (isCG) {
    document.getElementById('dCgColor').value = item.cgColor || '#e85d3a';
    document.getElementById('dTriggerCard').value = item.triggerCard || item.id;
    document.getElementById('dDrunkLevel').value = String(parseInt(item.level?.replace('Lv.', '') || '0'));
    document.getElementById('dInstantWin').checked = !!item.instantWin;
    populateTriggerCardSelect(item.triggerCard || item.id);
  }

  renderFrames(item);
  renderDialogue(item);
  renderList();
}

function showEmpty() {
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('detailView').style.display = 'none';
}

function saveMeta() {
  const item = items.find(i => i.id === selectedId);
  if (!item) return;
  const newFile = document.getElementById('dFile').value.trim();
  const newId = newFile.replace(/\.\w+$/, '');
  if (newId !== item.id) {
    if (items.some(i => i.id === newId && i !== item)) {
      toast(`ID "${newId}" は既に存在します`, 'err');
      return;
    }
    item.id = newId; selectedId = newId;
  }
  item.file = newFile;
  item.trigger = document.getElementById('dTrigger').value.trim();
  item.level = document.getElementById('dLevel').value;
  item.note = document.getElementById('dNote').value.trim();
  saveAll(); renderList(); updateCounts();
  checkFileExists(item).then(() => { updateFileStatus(item); renderList(); });
}

function renderPreview(item) {
  const el = document.getElementById('imgPreview');
  if (item.adoptedImage) {
    el.innerHTML = `<img src="${esc(item.adoptedImage)}" alt="${esc(item.trigger)}">`;
  } else if (item.history.length > 0) {
    el.innerHTML = `<img src="${esc(item.history[item.history.length - 1].url)}" alt="${esc(item.trigger)}">`;
  } else if (fileExistence[item.id] === true) {
    el.innerHTML = `<img src="${esc(getAssetPath(item))}" alt="${esc(item.trigger)}"><div style="position:absolute;bottom:8px;right:8px;background:var(--done);color:#000;padding:2px 8px;border-radius:4px;font-size:0.7em">ローカル</div>`;
  } else {
    el.innerHTML = `<div class="ph">画像なし</div>`;
  }
}

function renderHistory(item) {
  const strip = document.getElementById('histStrip');
  strip.innerHTML = '';
  for (let i = 0; i < item.history.length; i++) {
    const h = item.history[i];
    const t = document.createElement('div');
    t.className = 'hist-thumb' + (h.adopted ? ' adopted' : '');
    t.innerHTML = `<img src="${esc(h.url)}" alt="${i + 1}">`;
    t.onclick = () => {
      document.getElementById('imgPreview').innerHTML = `<img src="${esc(h.url)}" alt="${esc(item.trigger)}">`;
      strip.querySelectorAll('.hist-thumb').forEach(x => x.classList.remove('sel'));
      t.classList.add('sel');
    };
    strip.appendChild(t);
  }
}

function renderFeedback(item) {
  const sec = document.getElementById('fbSection');
  const log = document.getElementById('fbLog');
  if (!item.feedback?.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  log.innerHTML = '';
  for (const fb of item.feedback) {
    const time = new Date(fb.ts).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const e = document.createElement('div');
    e.className = 'fb-entry';
    e.innerHTML = `<span class="fb-time">${esc(time)}</span><span class="fb-reason">${esc(fb.reason)}</span>`;
    log.appendChild(e);
  }
}

// ============================================================
// Event Properties
// ============================================================

function saveEventProps() {
  const item = items.find(i => i.id === selectedId);
  if (!item || item.type !== 'cg') return;
  item.cgColor = document.getElementById('dCgColor').value;
  item.triggerCard = document.getElementById('dTriggerCard').value.trim();
  item.instantWin = document.getElementById('dInstantWin').checked;
  const dlVal = document.getElementById('dDrunkLevel').value;
  item.level = 'Lv.' + dlVal;
  document.getElementById('dLevel').value = item.level;
  saveAll();
}

// triggerCard ドロップダウンに harassment カード一覧を表示
function populateTriggerCardSelect(currentValue) {
  const sel = document.getElementById('dTriggerCardSelect');
  if (!sel) return;
  let html = '<option value="">選択...</option>';
  for (const card of harassmentCardCache) {
    const selected = card.id === currentValue ? ' selected' : '';
    html += `<option value="${esc(card.id)}"${selected}>${esc(card.name)} (${card.id})</option>`;
  }
  sel.innerHTML = html;
}

function onTriggerCardSelect() {
  const sel = document.getElementById('dTriggerCardSelect');
  if (!sel.value) return;
  document.getElementById('dTriggerCard').value = sel.value;
  // カード情報から酔いレベルも同期
  const card = harassmentCardCache.find(c => c.id === sel.value);
  if (card) {
    document.getElementById('dDrunkLevel').value = String(card.requiredDrunkLevel);
    document.getElementById('dInstantWin').checked = card.instantWin;
  }
  saveEventProps();
}
