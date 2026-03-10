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
