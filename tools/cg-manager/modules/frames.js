// ============================================================
// Frame Management
// ============================================================

function renderFrames(item) {
  const panel = document.getElementById('framePanel');
  const list = document.getElementById('frameList');
  const count = document.getElementById('frameCount');

  if (!item || item.type !== 'cg') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  if (!item.frames) item.frames = [];
  count.textContent = item.frames.length + ' フレーム';
  list.innerHTML = '';

  for (let i = 0; i < item.frames.length; i++) {
    const f = item.frames[i];
    const card = document.createElement('div');
    card.className = 'frame-card';

    const thumbContent = f.src
      ? `<img src="${f.src}" alt="F${i + 1}">`
      : '🖼';

    // フレームsrcからファイル名を抽出
    const currentFileName = f.src ? f.src.split('/').pop() : '';
    const isDataUrl = f.src && (f.src.startsWith('data:') || f.src.startsWith('idb:'));
    const fileExists = currentFileName && scannedCGFiles.includes(currentFileName);
    const srcWarning = currentFileName && !isDataUrl && !fileExists && scannedCGFiles.length > 0
      ? `<span class="frame-src-warn" title="ファイルが見つかりません: ${esc(currentFileName)}">⚠</span>`
      : '';

    // ファイル選択ドロップダウンを構築
    let fileSelectHtml = '';
    if (scannedCGFiles.length > 0) {
      fileSelectHtml = `<div>
        <label>画像ファイル ${srcWarning}</label>
        <select onchange="selectFrameFile(${i},this.value)" style="max-width:180px">
          <option value="">-- 選択 --</option>
          ${scannedCGFiles.map(fn => `<option value="${esc(fn)}"${fn === currentFileName ? ' selected' : ''}>${esc(fn)}</option>`).join('')}
        </select>
      </div>`;
    }

    card.innerHTML = `
      <span class="frame-num">#${i + 1}</span>
      <div class="frame-thumb" onclick="pickFrameImage(${i})" title="クリックで画像設定">${thumbContent}</div>
      <div class="frame-fields">
        ${fileSelectHtml}
        <div>
          <label>ラベル</label>
          <input value="${esc(f.label || '')}" onchange="updateFrame(${i},'label',this.value)" placeholder="シーン説明">
        </div>
        <div>
          <label>開始行</label>
          <input type="number" min="0" value="${f.dialogueStart || 0}" onchange="updateFrame(${i},'dialogueStart',parseInt(this.value)||0)">
        </div>
        <div>
          <label>トランジション</label>
          <select onchange="updateFrame(${i},'transition',this.value)">
            <option value="fade"${f.transition === 'fade' ? ' selected' : ''}>fade</option>
            <option value="slide-left"${f.transition === 'slide-left' ? ' selected' : ''}>slide-left</option>
            <option value="zoom"${f.transition === 'zoom' ? ' selected' : ''}>zoom</option>
            <option value="none"${f.transition === 'none' ? ' selected' : ''}>none</option>
          </select>
        </div>
      </div>
      <div class="frame-order-btns">
        <button onclick="moveFrame(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button onclick="moveFrame(${i},1)" ${i === item.frames.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <button class="sm danger frame-del" onclick="event.stopPropagation();removeFrame(${i})">✕</button>
    `;
    list.appendChild(card);
  }
}

function addFrame() {
  const item = items.find(i => i.id === selectedId);
  if (!item) return;
  if (!item.frames) item.frames = [];
  item.frames.push({ label: '', dialogueStart: item.dialogue?.length ? item.frames.length : 0, transition: 'fade', src: null });
  renderFrames(item);
  try { saveAll(); } catch(e) { console.warn('saveAll failed:', e); }
}

function removeFrame(idx) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.frames) return;
  item.frames.splice(idx, 1);
  renderFrames(item);
  try { saveAll(); } catch(e) { console.warn('saveAll failed:', e); }
}

function moveFrame(idx, dir) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.frames) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= item.frames.length) return;
  [item.frames[idx], item.frames[newIdx]] = [item.frames[newIdx], item.frames[idx]];
  renderFrames(item);
  try { saveAll(); } catch(e) { console.warn('saveAll failed:', e); }
}

function updateFrame(idx, key, val) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.frames?.[idx]) return;
  item.frames[idx][key] = val;
  saveAll();
}

function selectFrameFile(idx, fileName) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.frames?.[idx]) return;
  if (fileName) {
    item.frames[idx].src = `/characters/${currentCharId}/cg/${fileName}`;
  } else {
    item.frames[idx].src = null;
  }
  renderFrames(item);
  try { saveAll(); } catch(e) { console.warn('saveAll failed:', e); }
}

function pickFrameImage(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const item = items.find(i => i.id === selectedId);
      if (!item?.frames?.[idx]) return;
      item.frames[idx].src = ev.target.result;
      renderFrames(item);
      try { saveAll(); } catch(e) { console.warn('saveAll failed:', e); }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function exportAllFrameImages() {
  const frameEntries = [];
  for (const item of items) {
    if (item.type !== 'cg' || !item.frames) continue;
    for (let i = 0; i < item.frames.length; i++) {
      const f = item.frames[i];
      if (!f.src) continue;
      frameEntries.push({ itemId: item.id, frameIdx: i, src: f.src, label: f.label });
    }
  }

  if (frameEntries.length === 0) {
    toast('エクスポート対象のフレーム画像がありません', 'info');
    return;
  }

  const total = frameEntries.length;
  toast(`${total} 件のフレーム画像をエクスポート中...`, 'info');

  let success = 0;
  let failed = 0;

  for (const entry of frameEntries) {
    const fileName = `${entry.itemId}_frame${entry.frameIdx + 1}.webp`;
    try {
      const result = await convertToWebP(entry.src);

      if (projectDirHandle) {
        const basePath = `public/characters/${currentCharId}/cg`;
        const dir = await getSubDir(projectDirHandle, basePath);
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(result.blob);
        await writable.close();
      } else {
        const a = document.createElement('a');
        a.href = result.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(result.url);
      success++;
    } catch (err) {
      console.warn(`Frame export failed: ${fileName}`, err);
      failed++;
    }
  }

  if (failed > 0) {
    toast(`${success}/${total} 件エクスポート完了（${failed} 件失敗）`, 'info');
  } else {
    const dest = projectDirHandle ? `cg/ フォルダ` : 'ダウンロード';
    toast(`${success} 件のフレーム画像を${dest}にエクスポートしました`, 'ok');
  }
}
