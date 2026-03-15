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
// characters.ts 直接エクスポート
// ============================================================

async function exportToCharactersTS() {
  if (!projectDirHandle) {
    toast('先にフォルダを設定してください', 'err');
    return;
  }

  const cgItems = items.filter(i => i.type === 'cg');
  if (!cgItems.length) {
    toast('CGイベントがありません', 'err');
    return;
  }

  // characters.ts を読み込み
  let src = await readFileViaHandle('src/data/characters.ts');
  if (!src) {
    toast('characters.ts が見つかりません', 'err');
    return;
  }

  // 現在のキャラブロックを探す
  const charBlockRe = new RegExp(`(^|\\n)(  ${currentCharId}:\\s*\\{)`, 'm');
  const charMatch = charBlockRe.exec(src);
  if (!charMatch) {
    toast(`characters.ts に "${currentCharId}" が見つかりません`, 'err');
    return;
  }

  const charStart = charMatch.index + (charMatch[1] ? charMatch[1].length : 0);

  // キャラブロックの終わりを探す（次のトップレベルキャラ or ファイル末尾）
  const afterChar = src.slice(charStart);
  const nextCharRe = /\n  \w+:\s*\{/g;
  // 最初のマッチはスキップ（自分自身）
  nextCharRe.exec(afterChar);
  const nextMatch = nextCharRe.exec(afterChar);
  const charEnd = nextMatch ? charStart + nextMatch.index : src.lastIndexOf('};');

  const charBlock = src.slice(charStart, charEnd);

  // cgEvents ブロックを探す
  const cgEventsIdx = charBlock.indexOf('cgEvents:');
  if (cgEventsIdx < 0) {
    toast('cgEvents が見つかりません', 'err');
    return;
  }

  // cgEvents: [ ... ] の範囲を特定
  const bracketStart = charBlock.indexOf('[', cgEventsIdx);
  if (bracketStart < 0) {
    toast('cgEvents の [ が見つかりません', 'err');
    return;
  }

  let depth = 0;
  let bracketEnd = -1;
  for (let i = bracketStart; i < charBlock.length; i++) {
    if (charBlock[i] === '[') depth++;
    else if (charBlock[i] === ']') {
      depth--;
      if (depth === 0) { bracketEnd = i + 1; break; }
    }
  }
  if (bracketEnd < 0) {
    toast('cgEvents の ] が見つかりません', 'err');
    return;
  }

  // 新しい cgEvents コードを生成
  const newCgEvents = `cgEvents: [\n${cgItems.map(i => generateSingleEventCode(i)).join(',\n')}\n    ]`;

  // 置換
  const absStart = charStart + cgEventsIdx;
  const absEnd = charStart + bracketEnd;
  const oldBlock = src.slice(absStart, absEnd);

  // インデント補正: cgEvents: の前の空白を保持
  const lineStart = src.lastIndexOf('\n', absStart) + 1;
  const indent = src.slice(lineStart, absStart);

  const newSrc = src.slice(0, absStart) + newCgEvents + src.slice(absEnd);

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

    // キャッシュ更新
    charSourceRaw = newSrc;

    toast(`characters.ts の ${currentCharId}.cgEvents を更新しました (${cgItems.length}件)`, 'ok');
  } catch (e) {
    toast('書き込み失敗: ' + e.message, 'err');
  }
}

async function confirmExportToCharactersTS() {
  const cgItems = items.filter(i => i.type === 'cg');
  const msg = `characters.ts の ${currentCharId} の cgEvents を ${cgItems.length} 件のイベントで上書きします。\n\n続行しますか？`;
  if (confirm(msg)) {
    await exportToCharactersTS();
  }
}
