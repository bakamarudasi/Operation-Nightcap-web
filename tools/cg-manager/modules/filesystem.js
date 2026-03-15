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
      ? ['public', 'characters', currentCharId, 'cg', item.file]
      : ['public', 'characters', currentCharId, item.file];
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

    // アセットファイルをスキャン
    await scanAssetFiles(currentCharId);
    renderAssetSyncStatus();
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

// ============================================================
// Asset File Scanner — public/characters/{charId}/cg/ の実ファイル一覧取得
// ============================================================

let scannedCGFiles = [];      // 現在のキャラのCGフォルダ内ファイル一覧
let scannedPortraitFiles = []; // 立ち絵ファイル一覧

async function scanAssetFiles(charId) {
  scannedCGFiles = [];
  scannedPortraitFiles = [];

  if (!projectDirHandle) return;

  // CG フォルダスキャン
  try {
    let dir = projectDirHandle;
    for (const part of ['public', 'characters', charId, 'cg']) {
      dir = await dir.getDirectoryHandle(part);
    }
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && /\.(webp|png|jpg|jpeg|gif)$/i.test(entry.name)) {
        scannedCGFiles.push(entry.name);
      }
    }
    scannedCGFiles.sort();
  } catch {}

  // 立ち絵フォルダスキャン
  try {
    let dir = projectDirHandle;
    for (const part of ['public', 'characters', charId]) {
      dir = await dir.getDirectoryHandle(part);
    }
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && /\.(webp|png|jpg|jpeg|gif)$/i.test(entry.name)) {
        scannedPortraitFiles.push(entry.name);
      }
    }
    scannedPortraitFiles.sort();
  } catch {}
}

function getUnmatchedFiles() {
  const usedCGFiles = new Set(items.filter(i => i.type === 'cg').map(i => i.file));
  const usedPortraitFiles = new Set(items.filter(i => i.type === 'portrait').map(i => i.file));

  // フレームで使用されているファイル名も収集
  for (const item of items) {
    if (item.frames) {
      for (const f of item.frames) {
        if (f.src) {
          const fname = f.src.split('/').pop();
          if (fname) usedCGFiles.add(fname);
        }
      }
    }
  }

  return {
    cg: scannedCGFiles.filter(f => !usedCGFiles.has(f)),
    portrait: scannedPortraitFiles.filter(f => !usedPortraitFiles.has(f)),
  };
}

function getFramePathMismatches() {
  const warnings = [];
  for (const item of items) {
    if (item.type !== 'cg' || !item.frames) continue;
    for (let i = 0; i < item.frames.length; i++) {
      const f = item.frames[i];
      if (!f.src || f.src.startsWith('data:') || f.src.startsWith('idb:')) continue;
      const fname = f.src.split('/').pop();
      if (fname && !scannedCGFiles.includes(fname)) {
        warnings.push({
          itemId: item.id,
          frameIdx: i,
          src: f.src,
          fileName: fname,
          label: f.label || `Frame ${i + 1}`,
        });
      }
    }
  }
  return warnings;
}

function renderAssetSyncStatus() {
  const el = document.getElementById('assetSyncStatus');
  if (!el) return;

  if (!projectDirHandle) {
    el.innerHTML = '<span style="color:var(--text-dim)">フォルダ未設定</span>';
    return;
  }

  const unmatched = getUnmatchedFiles();
  const warnings = getFramePathMismatches();

  let html = '';

  if (warnings.length > 0) {
    html += `<div style="color:var(--missing);margin-bottom:4px">⚠ パス不一致: ${warnings.length}件</div>`;
    html += '<div class="sync-warnings">';
    for (const w of warnings) {
      html += `<div class="sync-warning-item" title="${esc(w.src)}">`;
      html += `<span class="sync-warn-icon">✕</span> `;
      html += `<strong>${esc(w.itemId)}</strong> ${esc(w.label)}: `;
      html += `<code>${esc(w.fileName)}</code> が見つかりません`;
      html += '</div>';
    }
    html += '</div>';
  }

  if (unmatched.cg.length > 0) {
    html += `<div style="color:var(--accent);margin-top:4px">📁 未使用CG画像: ${unmatched.cg.length}件</div>`;
    html += `<div class="sync-unmatched">${unmatched.cg.map(f => `<code>${esc(f)}</code>`).join(' ')}</div>`;
  }

  if (unmatched.portrait.length > 0) {
    html += `<div style="color:var(--accent);margin-top:4px">📁 未使用立ち絵: ${unmatched.portrait.length}件</div>`;
    html += `<div class="sync-unmatched">${unmatched.portrait.map(f => `<code>${esc(f)}</code>`).join(' ')}</div>`;
  }

  if (warnings.length === 0 && unmatched.cg.length === 0 && unmatched.portrait.length === 0) {
    if (scannedCGFiles.length > 0 || scannedPortraitFiles.length > 0) {
      html = `<span style="color:var(--done)">✓ 全ファイル同期済み (CG: ${scannedCGFiles.length}件, 立ち絵: ${scannedPortraitFiles.length}件)</span>`;
    } else {
      html = '<span style="color:var(--text-dim)">画像ファイルなし</span>';
    }
  }

  el.innerHTML = html;
}

async function rescanAssets() {
  if (!projectDirHandle) {
    toast('先にフォルダを設定してください', 'err');
    return;
  }
  await scanAssetFiles(currentCharId);
  renderAssetSyncStatus();
  // フレーム表示も更新
  const item = items.find(i => i.id === selectedId);
  if (item) renderFrames(item);
  toast(`アセットスキャン完了 (CG: ${scannedCGFiles.length}件, 立ち絵: ${scannedPortraitFiles.length}件)`, 'ok');
}

function buildFileSelectOptions(forCG) {
  const files = forCG ? scannedCGFiles : scannedPortraitFiles;
  return files.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
}
