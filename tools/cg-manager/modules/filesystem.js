// ============================================================
// File System Access API & Asset Management
// ============================================================

function getAssetPath(item) {
  if (item.type === 'cg') return `../public/characters/${currentCharId}/cg/${item.file}`;
  return `../public/characters/${currentCharId}/${item.file}`;
}

function checkFileExists(item) {
  if (location.protocol === 'file:' && projectDirHandle) {
    return checkFileExistsViaHandle(item);
  }
  if (location.protocol === 'file:') {
    fileExistence[item.id] = false;
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { fileExistence[item.id] = true; resolve(true); };
    img.onerror = () => { fileExistence[item.id] = false; resolve(false); };
    img.src = getAssetPath(item) + '?t=' + Date.now();
  });
}

async function checkFileExistsViaHandle(item) {
  try {
    const pathParts = item.type === 'cg'
      ? ['assets', 'characters', currentCharId, 'cg', item.file]
      : ['assets', 'characters', currentCharId, item.file];
    let dir = projectDirHandle;
    for (let i = 0; i < pathParts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(pathParts[i]);
    }
    await dir.getFileHandle(pathParts[pathParts.length - 1]);
    fileExistence[item.id] = true;
    return true;
  } catch {
    fileExistence[item.id] = false;
    return false;
  }
}

async function checkAllFiles() {
  await Promise.all(items.map(it => checkFileExists(it)));
  let changed = false;
  for (const item of items) {
    if (fileExistence[item.id] === true && item.status === 'pending') {
      item.status = 'done';
      changed = true;
    }
  }
  if (changed) {
    saveAll();
    updateCounts();
  }
  renderList();
  if (selectedId) updateFileStatus(items.find(i => i.id === selectedId));
}

function updateFileStatus(item) {
  const el = document.getElementById('fileStatus');
  if (!item) { el.textContent = ''; return; }
  const exists = fileExistence[item.id];
  const path = getAssetPath(item);
  if (exists === true) {
    el.innerHTML = `<span style="color:var(--done)">● 配置済み:</span> ${esc(path)}`;
  } else if (exists === false) {
    el.innerHTML = `<span style="color:var(--missing)">● 未配置:</span> ${esc(path)}`;
  } else {
    el.innerHTML = `<span>● 未確認:</span> ${esc(path)}`;
  }
}

async function pickProjectFolder() {
  if (!window.showDirectoryPicker) {
    toast('このブラウザはフォルダ選択に対応していません（Chrome/Edgeを使用してください）', 'err');
    return;
  }
  try {
    projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const el = document.getElementById('folderStatus');
    el.textContent = projectDirHandle.name;
    el.classList.add('active');
    toast(`出力先: ${projectDirHandle.name}/`, 'ok');

    if (!Object.keys(charDataCache || {}).length) {
      charDataCache = null;
      charSourceRaw = null;
      await fetchGameData();
      if (charDataCache && Object.keys(charDataCache).length) {
        const list = getCharList();
        let changed = false;
        for (const id of Object.keys(charDataCache)) {
          if (!list.includes(id)) { list.push(id); changed = true; }
        }
        if (changed) saveCharList(list);
        await load();
        renderCharTabs();
        renderList();
        updateCounts();
        checkAllFiles();
        toast('ゲームデータを読み込みました', 'ok');
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('フォルダ選択失敗', 'err');
  }
}

async function getSubDir(handle, path) {
  const parts = path.split('/').filter(Boolean);
  let dir = handle;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  return dir;
}

async function saveToFolder(blob, item) {
  const basePath = `public/characters/${currentCharId}`;
  const subPath = item.type === 'cg' ? `${basePath}/cg` : basePath;
  const dir = await getSubDir(projectDirHandle, subPath);
  const fileHandle = await dir.getFileHandle(item.file, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function getThumbSrc(item) {
  if (item.adoptedImage) return item.adoptedImage;
  if (item.history.length > 0) return item.history[item.history.length - 1].url;
  if (fileExistence[item.id] === true) return getAssetPath(item) + '?t=' + Date.now();
  return null;
}
