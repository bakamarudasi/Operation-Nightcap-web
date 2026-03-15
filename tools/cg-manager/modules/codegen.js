// ============================================================
// New CG Event Creation & Code Generation
// ============================================================

function showNewEventModal() {
  document.getElementById('newEvTriggerCard').value = '';
  document.getElementById('newEvTriggerName').value = '';
  document.getElementById('newEvDrunkLevel').value = '2';
  document.getElementById('newEvColor').value = '#e85d3a';
  document.getElementById('newEvInstantWin').checked = false;
  document.getElementById('newEventModal').classList.remove('hidden');
}

function doCreateEvent() {
  const triggerCard = document.getElementById('newEvTriggerCard').value.trim();
  const triggerName = document.getElementById('newEvTriggerName').value.trim();
  const drunkLevel = parseInt(document.getElementById('newEvDrunkLevel').value);
  const cgColor = document.getElementById('newEvColor').value;
  const instantWin = document.getElementById('newEvInstantWin').checked;

  if (!triggerCard) { toast('トリガーカードIDを入力してください', 'err'); return; }
  if (items.find(i => i.id === triggerCard)) { toast('このIDは既に存在します', 'err'); return; }

  const item = makeItem({
    id: triggerCard,
    file: triggerCard + '.webp',
    trigger: triggerName || triggerCard,
    level: 'Lv.' + drunkLevel,
    type: 'cg',
    note: '',
    triggerCard,
    cgColor,
    instantWin,
    dialogue: [],
    frames: [],
  });
  items.push(item);
  closeModal('newEventModal');
  saveAll();
  renderList();
  updateCounts();
  selectItem(triggerCard);
  toast(`CGイベント「${triggerName || triggerCard}」を作成`, 'ok');
}

// ============================================================
// Code Generation
// ============================================================

function escCode(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function generateSingleEventCode(item) {
  if (!item || item.type !== 'cg') return '';
  const I = '      ';
  const I2 = I + '  ';
  const I3 = I + '    ';
  const I4 = I + '      ';

  let code = `${I}{\n`;
  code += `${I2}id: '${item.triggerCard || item.id}_cg',\n`;
  code += `${I2}triggerCard: '${item.triggerCard || item.id}',\n`;
  code += `${I2}requiredDrunkLevel: ${parseInt(item.level?.replace('Lv.','') || '0')},\n`;
  code += `${I2}cgColor: '${item.cgColor || '#e85d3a'}',\n`;
  if (item.instantWin) code += `${I2}instantWin: true,\n`;

  if (item.dialogue?.length) {
    code += `${I2}dialogue: [\n`;
    for (const d of item.dialogue) {
      code += `${I3}{ speaker: '${escCode(d.speaker)}', text: '${escCode(d.text)}' },\n`;
    }
    code += `${I2}],\n`;
  } else {
    code += `${I2}dialogue: [],\n`;
  }

  if (item.frames?.length) {
    code += `${I2}frames: [\n`;
    for (let fi = 0; fi < item.frames.length; fi++) {
      const f = item.frames[fi];
      const isPath = f.src && !f.src.startsWith('data:') && !f.src.startsWith('idb:');
      const frameSrc = isPath
        ? f.src
        : `/characters/${currentCharId}/cg/${item.triggerCard || item.id}_${fi + 1}.webp`;
      code += `${I3}{\n`;
      code += `${I4}src: '${escCode(frameSrc)}',\n`;
      code += `${I4}label: '${escCode(f.label || '')}',\n`;
      code += `${I4}dialogueStart: ${f.dialogueStart || 0},\n`;
      code += `${I4}transition: '${f.transition || 'fade'}',\n`;
      code += `${I3}},\n`;
    }
    code += `${I2}],\n`;
  }

  code += `${I}}`;
  return code;
}

function generateEventCode() {
  const item = items.find(i => i.id === selectedId);
  if (!item || item.type !== 'cg') { toast('CGイベントを選択してください', 'err'); return; }
  document.getElementById('codeOutput').value = generateSingleEventCode(item);
}

function generateAllEventsCode() {
  const cgItems = items.filter(i => i.type === 'cg');
  if (!cgItems.length) { toast('CGイベントがありません', 'err'); return; }
  const code = `    cgEvents: [\n${cgItems.map(i => generateSingleEventCode(i)).join(',\n')}\n    ],`;
  document.getElementById('codeOutput').value = code;
}

function copyCodeOutput() {
  const text = document.getElementById('codeOutput').value;
  if (!text) { toast('コードがありません', 'err'); return; }
  navigator.clipboard.writeText(text)
    .then(() => toast('コピーしました', 'ok'))
    .catch(() => toast('コピー失敗', 'err'));
}

// ============================================================
// characters.ts 直接エクスポート（安全対策付き）
// ============================================================

// バックアップ保持（ロールバック用）
let lastExportBackup = null; // { src, timestamp, charId }

// --- バリデーション ---

function validateCGItems(cgItems) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  for (let i = 0; i < cgItems.length; i++) {
    const item = cgItems[i];
    const label = item.triggerCard || item.id || `#${i + 1}`;

    // 必須フィールド
    if (!item.triggerCard && !item.id) {
      errors.push(`[${label}] triggerCard が未設定`);
    }

    // ID重複チェック
    const evId = item.triggerCard || item.id;
    if (seenIds.has(evId)) {
      errors.push(`[${label}] triggerCard "${evId}" が重複しています`);
    }
    seenIds.add(evId);

    // 酔いレベル範囲
    const lvl = parseInt(item.level?.replace('Lv.', '') || '0');
    if (lvl < 0 || lvl > 4) {
      errors.push(`[${label}] requiredDrunkLevel が範囲外: ${lvl}`);
    }

    // セリフチェック
    if (!item.dialogue || item.dialogue.length === 0) {
      warnings.push(`[${label}] セリフが0行です`);
    }

    // フレームのパス存在チェック
    if (item.frames) {
      for (let fi = 0; fi < item.frames.length; fi++) {
        const f = item.frames[fi];
        const frameSrc = f.src;
        if (frameSrc && !frameSrc.startsWith('data:') && !frameSrc.startsWith('idb:')) {
          const fname = frameSrc.split('/').pop();
          if (scannedCGFiles.length > 0 && fname && !scannedCGFiles.includes(fname)) {
            warnings.push(`[${label}] Frame${fi + 1} "${fname}" がディスク上に見つかりません`);
          }
        }
      }

      // dialogueStart の整合性
      for (let fi = 0; fi < item.frames.length; fi++) {
        const ds = item.frames[fi].dialogueStart || 0;
        if (item.dialogue && ds >= item.dialogue.length) {
          warnings.push(`[${label}] Frame${fi + 1} の dialogueStart(${ds}) がセリフ行数(${item.dialogue.length})を超えています`);
        }
      }
    }
  }

  return { errors, warnings };
}

function validateGeneratedCode(code) {
  // 括弧の対応チェック
  let braces = 0, brackets = 0, parens = 0;
  let inString = false, stringChar = '';

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inString) {
      if (c === stringChar && code[i - 1] !== '\\') inString = false;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inString = true; stringChar = c; continue; }
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
  }

  const errors = [];
  if (braces !== 0) errors.push(`中括弧 {} の対応が不正 (差: ${braces})`);
  if (brackets !== 0) errors.push(`角括弧 [] の対応が不正 (差: ${brackets})`);
  if (parens !== 0) errors.push(`丸括弧 () の対応が不正 (差: ${parens})`);
  if (inString) errors.push('閉じられていない文字列があります');

  return errors;
}

// --- cgEvents ブロック検出 ---

function findCGEventsBlock(src, charId) {
  const charBlockRe = new RegExp(`(^|\\n)(  ${charId}:\\s*\\{)`, 'm');
  const charMatch = charBlockRe.exec(src);
  if (!charMatch) return { error: `characters.ts に "${charId}" が見つかりません` };

  const charStart = charMatch.index + (charMatch[1] ? charMatch[1].length : 0);

  const afterChar = src.slice(charStart);
  const nextCharRe = /\n  \w+:\s*\{/g;
  nextCharRe.exec(afterChar);
  const nextMatch = nextCharRe.exec(afterChar);
  const charEnd = nextMatch ? charStart + nextMatch.index : src.lastIndexOf('};');

  const charBlock = src.slice(charStart, charEnd);

  const cgEventsIdx = charBlock.indexOf('cgEvents:');
  if (cgEventsIdx < 0) return { error: 'cgEvents が見つかりません' };

  const bracketStart = charBlock.indexOf('[', cgEventsIdx);
  if (bracketStart < 0) return { error: 'cgEvents の [ が見つかりません' };

  let depth = 0, bracketEnd = -1;
  for (let i = bracketStart; i < charBlock.length; i++) {
    if (charBlock[i] === '[') depth++;
    else if (charBlock[i] === ']') { depth--; if (depth === 0) { bracketEnd = i + 1; break; } }
  }
  if (bracketEnd < 0) return { error: 'cgEvents の ] が見つかりません' };

  return {
    absStart: charStart + cgEventsIdx,
    absEnd: charStart + bracketEnd,
    oldBlock: src.slice(charStart + cgEventsIdx, charStart + bracketEnd),
  };
}

// --- 差分生成 ---

function generateDiff(oldBlock, newBlock) {
  const oldLines = oldBlock.split('\n');
  const newLines = newBlock.split('\n');
  const diff = [];

  // 簡易diff: 行ごとに比較
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oldIdx = 0, newIdx = 0;

  // LCS的なアプローチの簡易版
  const oldSet = new Set(oldLines.map(l => l.trim()));
  const newSet = new Set(newLines.map(l => l.trim()));

  for (const line of oldLines) {
    if (!newSet.has(line.trim())) {
      diff.push({ type: 'remove', text: line });
    } else {
      diff.push({ type: 'same', text: line });
    }
  }
  for (const line of newLines) {
    if (!oldSet.has(line.trim())) {
      diff.push({ type: 'add', text: line });
    }
  }

  return diff;
}

function renderDiffHtml(oldBlock, newBlock) {
  const oldLines = oldBlock.split('\n');
  const newLines = newBlock.split('\n');

  let html = '<div class="diff-view">';
  html += '<div class="diff-header">変更前 (現在の characters.ts)</div>';
  html += '<pre class="diff-old">';
  for (const line of oldLines) {
    html += `<div class="diff-line diff-remove">${esc(line)}</div>`;
  }
  html += '</pre>';
  html += '<div class="diff-header">変更後 (CGマネージャーのデータ)</div>';
  html += '<pre class="diff-new">';
  for (const line of newLines) {
    html += `<div class="diff-line diff-add">${esc(line)}</div>`;
  }
  html += '</pre>';
  html += '</div>';
  return html;
}

// --- メイン処理 ---

async function prepareExport() {
  if (!projectDirHandle) {
    toast('先にフォルダを設定してください', 'err');
    return;
  }

  const cgItems = items.filter(i => i.type === 'cg');
  if (!cgItems.length) {
    toast('CGイベントがありません', 'err');
    return;
  }

  // 1. バリデーション
  const validation = validateCGItems(cgItems);

  if (validation.errors.length > 0) {
    toast('エラーがあります。修正してください', 'err');
    showExportPreviewModal(null, null, null, validation, null);
    return;
  }

  // 2. characters.ts 読み込み
  const src = await readFileViaHandle('src/data/characters.ts');
  if (!src) {
    toast('characters.ts が見つかりません', 'err');
    return;
  }

  // 3. cgEvents ブロック検出
  const block = findCGEventsBlock(src, currentCharId);
  if (block.error) {
    toast(block.error, 'err');
    return;
  }

  // 4. 新しいコード生成
  const newCgEvents = `cgEvents: [\n${cgItems.map(i => generateSingleEventCode(i)).join(',\n')}\n    ]`;

  // 5. 生成コードのバリデーション
  const codeErrors = validateGeneratedCode(newCgEvents);
  if (codeErrors.length > 0) {
    validation.errors.push(...codeErrors.map(e => `[構文] ${e}`));
    showExportPreviewModal(null, null, null, validation, null);
    return;
  }

  // 6. 差分プレビューモーダルを表示
  showExportPreviewModal(src, block, newCgEvents, validation, cgItems);
}

function showExportPreviewModal(src, block, newCgEvents, validation, cgItems) {
  let modal = document.getElementById('exportPreviewModal');
  if (!modal) {
    // モーダルを動的に作成
    modal = document.createElement('div');
    modal.className = 'modal-overlay hidden';
    modal.id = 'exportPreviewModal';
    modal.innerHTML = `
      <div class="modal" style="width:850px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column">
        <h3 id="exportPreviewTitle">characters.ts エクスポート確認</h3>
        <div id="exportPreviewContent" style="overflow-y:auto;flex:1"></div>
        <div class="ma" id="exportPreviewActions"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  let contentHtml = '';

  // バリデーション結果
  if (validation.errors.length > 0) {
    contentHtml += '<div class="export-section export-errors">';
    contentHtml += '<h4>❌ エラー（修正が必要）</h4>';
    for (const e of validation.errors) contentHtml += `<div class="export-error-item">${esc(e)}</div>`;
    contentHtml += '</div>';
  }

  if (validation.warnings.length > 0) {
    contentHtml += '<div class="export-section export-warnings">';
    contentHtml += `<h4>⚠ 警告 (${validation.warnings.length}件)</h4>`;
    for (const w of validation.warnings) contentHtml += `<div class="export-warn-item">${esc(w)}</div>`;
    contentHtml += '</div>';
  }

  // 差分表示
  if (block && newCgEvents) {
    contentHtml += '<div class="export-section">';
    contentHtml += `<h4>📝 変更内容 (${currentCharId}.cgEvents → ${cgItems.length}件)</h4>`;
    contentHtml += renderDiffHtml(block.oldBlock, newCgEvents);
    contentHtml += '</div>';
  }

  document.getElementById('exportPreviewContent').innerHTML = contentHtml;

  // アクションボタン
  let actionsHtml = `<button onclick="closeModal('exportPreviewModal')">キャンセル</button>`;
  if (validation.errors.length === 0 && src && block && newCgEvents) {
    actionsHtml += `<button class="primary" onclick="doExportToCharactersTS()" style="background:#2a6a3e;border-color:var(--done)">✅ 反映する</button>`;
    // 一時的にデータを保持
    window._pendingExport = { src, block, newCgEvents };
  }

  document.getElementById('exportPreviewActions').innerHTML = actionsHtml;
  modal.classList.remove('hidden');
}

async function doExportToCharactersTS() {
  const pending = window._pendingExport;
  if (!pending) { toast('エクスポートデータがありません', 'err'); return; }

  const { src, block, newCgEvents } = pending;

  // バックアップ保存
  lastExportBackup = {
    src: src,
    timestamp: new Date().toLocaleString('ja-JP'),
    charId: currentCharId,
  };

  // 置換
  const newSrc = src.slice(0, block.absStart) + newCgEvents + src.slice(block.absEnd);

  // ファイルに書き戻し
  try {
    const parts = 'src/data/characters.ts'.split('/');
    let dir = projectDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const writable = await fileHandle.createWritable();
    await writable.write(newSrc);
    await writable.close();

    charSourceRaw = newSrc;
    window._pendingExport = null;
    closeModal('exportPreviewModal');

    // ロールバックボタン表示
    updateRollbackUI(true);

    toast(`✅ characters.ts の ${currentCharId}.cgEvents を更新しました`, 'ok');
  } catch (e) {
    toast('書き込み失敗: ' + e.message, 'err');
  }
}

async function rollbackExport() {
  if (!lastExportBackup) {
    toast('バックアップがありません', 'err');
    return;
  }

  if (!confirm(`${lastExportBackup.timestamp} のバックアップに戻しますか？\n(${lastExportBackup.charId} の変更を取り消します)`)) return;

  try {
    const parts = 'src/data/characters.ts'.split('/');
    let dir = projectDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const writable = await fileHandle.createWritable();
    await writable.write(lastExportBackup.src);
    await writable.close();

    charSourceRaw = lastExportBackup.src;
    lastExportBackup = null;
    updateRollbackUI(false);

    toast('ロールバック完了 — 元に戻しました', 'ok');
  } catch (e) {
    toast('ロールバック失敗: ' + e.message, 'err');
  }
}

function updateRollbackUI(show) {
  const btn = document.getElementById('rollbackBtn');
  if (btn) btn.style.display = show ? 'inline-block' : 'none';
}

// 旧 confirm 版を差分プレビュー版に置き換え
async function confirmExportToCharactersTS() {
  await prepareExport();
}
