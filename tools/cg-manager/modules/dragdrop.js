// ============================================================
// Drag & Drop + Image Assignment
// ============================================================

function setupDragDrop() {
  let dragCounter = 0;
  const overlay = () => document.getElementById('dropOverlay');

  document.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    overlay().classList.add('active');
  });
  document.addEventListener('dragleave', e => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; overlay().classList.remove('active'); }
  });
  document.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    overlay().classList.remove('active');
    const imageFiles = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast('画像ファイルのみ対応', 'err'); return; }
    if (imageFiles.length === 1) {
      handleDroppedImage(imageFiles[0]);
    } else {
      handleDroppedImages(imageFiles);
    }
  });
}

function setupPaste() {
  document.addEventListener('paste', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    if (files.length === 1) {
      handleDroppedImage(files[0]);
    } else {
      handleDroppedImages(files);
    }
  });
}

function handleDroppedImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    pendingDropImage = { dataUrl: e.target.result, fileName: file.name };
    showAssignModal();
  };
  reader.readAsDataURL(file);
}

function handleDroppedImages(files) {
  pendingBatchImages = [];
  let loaded = 0;
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of sorted) {
    const reader = new FileReader();
    reader.onload = e => {
      pendingBatchImages.push({ dataUrl: e.target.result, fileName: file.name });
      loaded++;
      if (loaded === sorted.length) {
        pendingBatchImages.sort((a, b) => a.fileName.localeCompare(b.fileName));
        showBatchAssignModal();
      }
    };
    reader.readAsDataURL(file);
  }
}

function showBatchAssignModal() {
  const charSelect = document.getElementById('batchChar');
  const list = getCharList();
  charSelect.innerHTML = list.map(id => {
    const info = getCharInfo(id);
    const data = loadCharData(id);
    const label = data?.charName || info?.name || id;
    return `<option value="${esc(id)}"${id === currentCharId ? ' selected' : ''}>${esc(label)} (${esc(id)})</option>`;
  }).join('');

  onBatchCharChange();
  document.getElementById('batchAssignModal').classList.remove('hidden');
}

function onBatchCharChange() {
  const charId = document.getElementById('batchChar').value;
  const info = getCharInfo(charId);
  const container = document.getElementById('batchList');
  container.innerHTML = '';

  document.getElementById('batchCount').textContent = `${pendingBatchImages.length} 件の画像`;

  function buildSceneOptions(autoMatchId) {
    let opts = '';
    const reverseIdSet = new Set(reverseHarassCards.map(rc => rc.id));
    if (info) {
      for (const ev of info.cgEvents) {
        const cardName = cardNameCache[ev.triggerCard] || ev.triggerCard;
        const isRev = reverseIdSet.has(ev.triggerCard);
        const suffix = ev.instantWin ? ' \u2605' : isRev ? ' \uD83D\uDD25逆セクハラ' : '';
        const label = `${cardName} (Lv.${ev.requiredDrunkLevel})${suffix}`;
        const sel = (autoMatchId && ev.triggerCard === autoMatchId) ? ' selected' : '';
        opts += `<option value="cg:${esc(ev.triggerCard)}"${sel}>${esc(label)}</option>`;
      }
    }
    const existingTriggers = new Set(info?.cgEvents.map(e => e.triggerCard) || []);
    for (const rc of reverseHarassCards) {
      if (existingTriggers.has(rc.id)) continue;
      const cardName = cardNameCache[rc.id] || rc.id;
      const label = `${cardName} \uD83D\uDD25逆セクハラ (Lv.${rc.requiredDrunkLevel})`;
      const sel = (autoMatchId && rc.id === autoMatchId) ? ' selected' : '';
      opts += `<option value="cg:${esc(rc.id)}"${sel}>${esc(label)}</option>`;
    }
    opts += `<option value="portrait:portrait">基本立ち絵</option>`;
    const drunkLabels = ['素面', 'ほろ酔い', '酔い', 'べろべろ', '潰れ'];
    const levels = info ? info.costumeLevels : 5;
    for (let i = 0; i < levels; i++) {
      opts += `<option value="portrait:portrait-drunk-${i}">${drunkLabels[i] || 'Lv.' + i} 立ち絵</option>`;
    }
    opts += `<option value="icon:select-icon">選択アイコン</option>`;
    return opts;
  }

  for (let i = 0; i < pendingBatchImages.length; i++) {
    const img = pendingBatchImages[i];
    const baseName = img.fileName.replace(/\.\w+$/, '');
    const autoMatch = tryMatchCardId(baseName, info);

    const row = document.createElement('div');
    row.className = 'batch-item';
    row.innerHTML = `
      <div>
        <img class="batch-thumb" src="${esc(img.dataUrl)}" alt="">
        <div class="batch-fname">${esc(img.fileName)}</div>
      </div>
      <select id="batchScene_${i}">${buildSceneOptions(autoMatch)}</select>
    `;
    container.appendChild(row);
  }
}

function tryMatchCardId(name, info) {
  if (!info) return null;
  for (const ev of info.cgEvents) {
    if (ev.triggerCard === name) return ev.triggerCard;
  }
  for (const ev of info.cgEvents) {
    if (name.includes(ev.triggerCard)) return ev.triggerCard;
  }
  for (const rc of reverseHarassCards) {
    if (name === rc.id || name.includes(rc.id)) return rc.id;
  }
  return null;
}

async function doBatchAssign() {
  if (pendingBatchImages.length === 0) return;
  const charId = document.getElementById('batchChar').value;

  if (charId !== currentCharId) {
    saveAll();
    currentCharId = charId;
    localStorage.setItem(LASTCHAR_KEY, charId);
    selectedId = null;
    fileExistence = {};
    await load();
  }

  let count = 0;
  for (let i = 0; i < pendingBatchImages.length; i++) {
    const img = pendingBatchImages[i];
    const sceneSelect = document.getElementById('batchScene_' + i);
    if (!sceneSelect) continue;
    const sceneVal = sceneSelect.value;
    const [type, id] = sceneVal.split(':');
    const ext = (img.fileName.match(/\.\w+$/) || ['.png'])[0];

    let item = items.find(it => it.id === id);
    if (!item) {
      const trigger = type === 'cg'
        ? (cardNameCache[id] || id)
        : type === 'portrait' ? (id === 'portrait' ? '基本立ち絵' : id)
        : 'キャラ選択画面用';
      item = makeItem({ id, file: id + ext, trigger, level: '', type, note: '' });
      items.push(item);
    }
    item.history.push({ url: img.dataUrl, ts: new Date().toISOString(), adopted: false });
    item.status = 'review';
    count++;
  }

  pendingBatchImages = [];
  closeModal('batchAssignModal');
  saveAll();
  renderCharTabs();
  renderList();
  updateCounts();
  toast(`${count} 件の画像を一括割り当て → レビュー待ち`, 'ok');
  checkAllFiles();
}

function showAssignModal() {
  if (!pendingDropImage) return;

  document.getElementById('assignPreview').innerHTML =
    `<img src="${esc(pendingDropImage.dataUrl)}" alt="preview">`;

  const charSelect = document.getElementById('assignChar');
  const list = getCharList();
  charSelect.innerHTML = list.map(id => {
    const info = getCharInfo(id);
    const data = loadCharData(id);
    const label = data?.charName || info?.name || id;
    return `<option value="${esc(id)}"${id === currentCharId ? ' selected' : ''}>${esc(label)} (${esc(id)})</option>`;
  }).join('');

  onAssignCharChange();
  document.getElementById('assignModal').classList.remove('hidden');
}

function onAssignCharChange() {
  const charId = document.getElementById('assignChar').value;
  const sceneSelect = document.getElementById('assignScene');
  const info = getCharInfo(charId);

  let opts = '';
  const reverseIdSet = new Set(reverseHarassCards.map(rc => rc.id));
  if (info) {
    for (const ev of info.cgEvents) {
      const cardName = cardNameCache[ev.triggerCard] || ev.triggerCard;
      const isRev = reverseIdSet.has(ev.triggerCard);
      const suffix = ev.instantWin ? ' ★' : isRev ? ' \uD83D\uDD25逆セクハラ' : '';
      const label = `${cardName} (Lv.${ev.requiredDrunkLevel})${suffix}`;
      opts += `<option value="cg:${esc(ev.triggerCard)}">${esc(label)}</option>`;
    }
  }

  const existingTriggers = new Set(info?.cgEvents.map(e => e.triggerCard) || []);
  for (const rc of reverseHarassCards) {
    if (existingTriggers.has(rc.id)) continue;
    const cardName = cardNameCache[rc.id] || rc.id;
    const label = `${cardName} \uD83D\uDD25逆セクハラ (Lv.${rc.requiredDrunkLevel})`;
    opts += `<option value="cg:${esc(rc.id)}">${esc(label)}</option>`;
  }

  opts += `<option value="portrait:portrait">基本立ち絵</option>`;
  const drunkLabels = ['素面', 'ほろ酔い', '酔い', 'べろべろ', '潰れ'];
  const levels = info ? info.costumeLevels : 5;
  for (let i = 0; i < levels; i++) {
    opts += `<option value="portrait:portrait-drunk-${i}">${drunkLabels[i] || 'Lv.' + i} 立ち絵</option>`;
  }
  opts += `<option value="icon:select-icon">選択アイコン</option>`;

  sceneSelect.innerHTML = opts;
  updateAssignInfo();
  sceneSelect.onchange = updateAssignInfo;
}

function getDropExt() {
  if (!pendingDropImage?.fileName) return '.png';
  const m = pendingDropImage.fileName.match(/\.\w+$/);
  return m ? m[0] : '.png';
}

function updateAssignInfo() {
  const charId = document.getElementById('assignChar').value;
  const sceneVal = document.getElementById('assignScene').value;
  const [type, id] = sceneVal.split(':');
  const ext = getDropExt();
  const file = id + ext;
  const path = type === 'cg'
    ? `public/characters/${charId}/cg/${file}`
    : `public/characters/${charId}/${file}`;

  document.getElementById('assignInfo').innerHTML =
    `自動ファイル名: <span class="auto-name">${esc(file)}</span><br>` +
    `配置先: <span class="auto-name">${esc(path)}</span>`;
}

async function doAssign() {
  if (!pendingDropImage) return;

  const charId = document.getElementById('assignChar').value;
  const sceneVal = document.getElementById('assignScene').value;
  const [type, id] = sceneVal.split(':');

  if (charId !== currentCharId) {
    saveAll();
    currentCharId = charId;
    localStorage.setItem(LASTCHAR_KEY, charId);
    selectedId = null;
    fileExistence = {};
    await load();
  }

  let item = items.find(i => i.id === id);
  if (!item) {
    const trigger = type === 'cg'
      ? (cardNameCache[id] || id)
      : type === 'portrait' ? (id === 'portrait' ? '基本立ち絵' : id)
      : 'キャラ選択画面用';
    item = makeItem({ id, file: id + getDropExt(), trigger, level: '', type, note: '' });
    items.push(item);
  }

  item.history.push({ url: pendingDropImage.dataUrl, ts: new Date().toISOString(), adopted: false });
  item.status = 'review';

  pendingDropImage = null;
  closeModal('assignModal');
  saveAll();
  renderCharTabs();
  renderList();
  updateCounts();
  selectItem(item.id);
  toast(`「${item.trigger}」に画像を追加 → レビュー待ち`, 'ok');
  checkAllFiles();
}
