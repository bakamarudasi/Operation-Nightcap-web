// ============================================================
// Dialogue Editor
// ============================================================

function renderDialogue(item) {
  const panel = document.getElementById('dialoguePanel');
  const list = document.getElementById('dlgList');
  const count = document.getElementById('dlgCount');

  if (!item || item.type !== 'cg') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  if (!item.dialogue) item.dialogue = [];
  count.textContent = item.dialogue.length + ' 行';
  list.innerHTML = '';

  const charInfo = getCharInfo(currentCharId);
  const charName = charInfo?.name || currentCharId;

  for (let i = 0; i < item.dialogue.length; i++) {
    const d = item.dialogue[i];
    const line = document.createElement('div');
    line.className = 'dlg-line';

    const knownSpeakers = ['ドクター', charName, '', '__custom__'];
    const isKnown = knownSpeakers.includes(d.speaker);
    const selVal = isKnown ? d.speaker : '__custom__';
    const showCustom = !isKnown;

    line.innerHTML = `
      <span class="dlg-num">${i}</span>
      <div class="dlg-speaker-wrap">
        <select class="dlg-speaker-sel" onchange="onSpeakerSelect(${i},this)">
          <option value="ドクター" ${selVal === 'ドクター' ? 'selected' : ''}>ドクター</option>
          <option value="${esc(charName)}" ${selVal === charName ? 'selected' : ''}>${esc(charName)}</option>
          <option value="" ${selVal === '' ? 'selected' : ''}>(ナレーション)</option>
          <option value="__custom__" ${selVal === '__custom__' ? 'selected' : ''}>自由入力</option>
        </select>
        <input class="dlg-speaker-custom" value="${esc(showCustom ? d.speaker : '')}"
          style="display:${showCustom ? 'block' : 'none'}"
          onchange="updateDialogue(${i},'speaker',this.value)" placeholder="話者名">
      </div>
      <div class="dlg-text-wrap">
        <input class="dlg-text" value="${esc(d.text)}" onchange="updateDialogue(${i},'text',this.value)" oninput="updateCharCount(this)" placeholder="セリフ">
        <span class="dlg-charcount ${d.text.length > 60 ? 'over' : d.text.length > 45 ? 'warn' : ''}">${d.text.length}</span>
      </div>
      <div class="dlg-btns">
        <button onclick="moveDialogue(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button onclick="moveDialogue(${i},1)" ${i === item.dialogue.length - 1 ? 'disabled' : ''}>▼</button>
        <button onclick="insertDialogueAfter(${i})" title="下に行を追加">＋</button>
        <button class="danger" onclick="removeDialogue(${i})">✕</button>
      </div>
    `;
    list.appendChild(line);
  }
}

function addDialogueLine() {
  const item = items.find(i => i.id === selectedId);
  if (!item) return;
  if (!item.dialogue) item.dialogue = [];
  const info = getCharInfo(currentCharId);
  const speaker = info?.name || currentCharId;
  item.dialogue.push({ speaker, text: '' });
  saveAll();
  renderDialogue(item);
  setTimeout(() => {
    const inputs = document.querySelectorAll('#dlgList .dlg-text');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function insertDialogueAfter(idx) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.dialogue) return;
  const info = getCharInfo(currentCharId);
  const speaker = info?.name || currentCharId;
  item.dialogue.splice(idx + 1, 0, { speaker, text: '' });
  saveAll();
  renderDialogue(item);
  setTimeout(() => {
    const inputs = document.querySelectorAll('#dlgList .dlg-text');
    if (inputs[idx + 1]) inputs[idx + 1].focus();
  }, 50);
}

function removeDialogue(idx) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.dialogue) return;
  item.dialogue.splice(idx, 1);
  saveAll();
  renderDialogue(item);
}

function moveDialogue(idx, dir) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.dialogue) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= item.dialogue.length) return;
  [item.dialogue[idx], item.dialogue[newIdx]] = [item.dialogue[newIdx], item.dialogue[idx]];
  saveAll();
  renderDialogue(item);
}

function updateCharCount(input) {
  const count = input.value.length;
  const span = input.parentElement.querySelector('.dlg-charcount');
  if (!span) return;
  span.textContent = count;
  span.className = 'dlg-charcount' + (count > 60 ? ' over' : count > 45 ? ' warn' : '');
}

function updateDialogue(idx, key, val) {
  const item = items.find(i => i.id === selectedId);
  if (!item?.dialogue?.[idx]) return;
  item.dialogue[idx][key] = val;
  saveAll();
}

function onSpeakerSelect(idx, sel) {
  const val = sel.value;
  const wrap = sel.closest('.dlg-speaker-wrap');
  const customInput = wrap.querySelector('.dlg-speaker-custom');
  if (val === '__custom__') {
    customInput.style.display = 'block';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    updateDialogue(idx, 'speaker', val);
  }
}
