// ============================================================
// Import / Export – Manifest
// ============================================================

function showImportModal() {
  document.getElementById('importModal').classList.remove('hidden');
  document.getElementById('importText').value = '';
}

function showExportModal() {
  document.getElementById('exportText').value = generateManifest();
  document.getElementById('exportModal').classList.remove('hidden');
}

function handleFileLoad(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('importText').value = e.target.result;
    toast('ファイル読み込み完了', 'ok');
  };
  reader.readAsText(file);
  event.target.value = '';
}

function generateManifest() {
  const data = loadCharData(currentCharId) || {};
  const info = getCharInfo(currentCharId);
  const charName = data.charName || info?.name || '';
  const charNameEn = data.charNameEn || info?.nameEn || currentCharId.toUpperCase();
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

  const cgs = items.filter(i => i.type === 'cg');
  const portraits = items.filter(i => i.type === 'portrait');
  const icons = items.filter(i => i.type === 'icon');
  const total = items.length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const statusLine = doneCount === total ? '全て作成済み' :
    doneCount > 0 ? `${doneCount}/${total}枚 作成済み` : '全て未作成';

  let o = '';
  o += '# ============================================\n';
  o += '# Operation Nightcap - CG Manifest\n';
  o += `# Character: ${charNameEn} (${charName})\n`;
  o += '# ============================================\n';
  o += '#\n# フォーマット: ファイル名 | トリガー | 酔いLv | 備考\n';
  o += '# ============================================\n\n';

  o += `# --- イベントCG (${cgs.length}枚) ---\n`;
  o += `# 配置先: public/characters/${currentCharId}/cg/\n\n`;
  for (const r of cgs) o += `${pad(r.file, 26)}| ${pad(r.trigger, 18)}| ${pad(r.level || '', 6)}| ${r.note || ''}`.replace(/\s+$/, '') + '\n';

  o += `\n# --- 立ち絵 (${portraits.length}枚) ---\n`;
  o += `# 配置先: public/characters/${currentCharId}/\n\n`;
  for (const r of portraits) o += `${pad(r.file, 26)}| ${pad(r.trigger, 18)}| ${pad(r.level || '', 6)}| ${r.note || ''}`.replace(/\s+$/, '') + '\n';

  o += `\n# --- アイコン (${icons.length}枚) ---\n`;
  o += `# 配置先: public/characters/${currentCharId}/\n\n`;
  for (const r of icons) o += `${pad(r.file, 26)}| ${pad(r.trigger, 18)}| ${r.note || ''}`.replace(/\s+$/, '') + '\n';

  o += `\n# ============================================\n`;
  o += `# 合計: ${total}枚\n`;
  o += `# ステータス: ${statusLine}\n`;
  o += '# ============================================\n';
  return o;
}

function copyManifest() {
  navigator.clipboard.writeText(document.getElementById('exportText').value)
    .then(() => toast('コピーしました', 'ok'))
    .catch(() => toast('コピー失敗', 'err'));
}

function downloadManifest() {
  const data = loadCharData(currentCharId) || {};
  const en = data.charNameEn || getCharInfo(currentCharId)?.nameEn || currentCharId;
  const blob = new Blob([generateManifest()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${en.toLowerCase()}.txt`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('ダウンロード完了', 'ok');
}

function doImport() {
  const text = document.getElementById('importText').value;
  if (!text.trim()) { toast('空です', 'err'); return; }

  const lines = text.split('\n');
  let section = null;
  const newItems = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#') || t === '') {
      if (t.includes('イベントCG')) section = 'cg';
      else if (t.includes('立ち絵') || t.includes('ポートレート')) section = 'portrait';
      else if (t.includes('アイコン')) section = 'icon';
      else if (t.includes('合計')) section = null;
      continue;
    }
    if (!section) continue;
    const parts = t.split('|').map(s => s.trim());
    if (parts.length < 2) continue;
    const file = parts[0], trigger = parts[1], level = parts[2] || '', note = parts[3] || '';
    const id = file.replace(/\.\w+$/, '');

    const existing = items.find(i => i.id === id);
    if (existing) {
      existing.file = file; existing.trigger = trigger;
      existing.level = level; existing.note = note; existing.type = section;
      newItems.push(existing);
    } else {
      newItems.push(makeItem({ id, file, trigger, level, type: section, note }));
    }
  }

  if (newItems.length > 0) {
    items = newItems;
    saveAll(); renderList(); updateCounts();
    closeModal('importModal');
    toast(`インポート: ${newItems.length}件`, 'ok');
    checkAllFiles();
  } else {
    toast('パースできませんでした', 'err');
  }
}
