// ============================================================
// Character Comparison View
// ============================================================

function showCompareView() {
  const charList = getCharList();
  if (charList.length < 1) { toast('キャラが1人以上必要です', 'err'); return; }

  const allTriggers = new Set();
  const charItems = {};

  for (const charId of charList) {
    const data = loadCharData(charId);
    const itemMap = {};
    if (data?.items) {
      for (const it of data.items) {
        if (it.type === 'cg') {
          allTriggers.add(it.id);
          itemMap[it.id] = it.status;
        }
      }
    }
    charItems[charId] = itemMap;
  }

  if (charDataCache) {
    for (const charId of charList) {
      const info = charDataCache[charId];
      if (info?.cgEvents) {
        for (const ev of info.cgEvents) {
          allTriggers.add(ev.triggerCard);
        }
      }
    }
  }
  for (const rc of reverseHarassCards) {
    allTriggers.add(rc.id);
  }

  const triggerList = [...allTriggers].sort();

  let summaryHtml = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">';
  for (const charId of charList) {
    const info = getCharInfo(charId);
    const data = loadCharData(charId);
    const label = data?.charName || info?.name || charId;
    const total = triggerList.length;
    const done = triggerList.filter(t => charItems[charId]?.[t] === 'done').length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    summaryHtml += `
      <div class="compare-summary" style="flex:1;min-width:150px;flex-direction:column">
        <div style="display:flex;justify-content:space-between">
          <span class="cs-char">${esc(label)}</span>
          <span style="color:var(--text-dim)">${done}/${total} (${pct}%)</span>
        </div>
        <div class="cs-bar"><div class="cs-fill" style="width:${pct}%"></div></div>
      </div>`;
  }
  summaryHtml += '</div>';

  let tableHtml = '<table class="compare-table"><thead><tr><th class="cg-name">CGイベント</th>';
  for (const charId of charList) {
    const info = getCharInfo(charId);
    const data = loadCharData(charId);
    const label = data?.charName || info?.name || charId;
    tableHtml += `<th>${esc(label)}</th>`;
  }
  tableHtml += '</tr></thead><tbody>';

  for (const trigger of triggerList) {
    const triggerName = cardNameCache[trigger] || trigger;
    const isReverse = reverseHarassCards.some(rc => rc.id === trigger);
    const reverseTag = isReverse ? ' <span style="color:#c77dff;font-size:0.8em">逆</span>' : '';

    tableHtml += `<tr><td class="cg-name">${esc(triggerName)}${reverseTag}</td>`;
    for (const charId of charList) {
      const status = charItems[charId]?.[trigger];
      let cls, title;
      if (status === 'done') { cls = 'done'; title = '採用済'; }
      else if (status === 'review') { cls = 'review'; title = 'レビュー中'; }
      else if (status === 'pending') { cls = 'pending'; title = '未作成'; }
      else { cls = 'none'; title = '未定義'; }
      tableHtml += `<td><span class="compare-cell ${cls}" title="${title}"></span></td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table>';

  const legendHtml = `
    <div class="compare-legend">
      <span><span class="compare-cell done"></span> 採用済</span>
      <span><span class="compare-cell review"></span> レビュー中</span>
      <span><span class="compare-cell pending"></span> 未作成</span>
      <span><span class="compare-cell none"></span> 未定義</span>
    </div>`;

  const overlay = document.getElementById('compareOverlay');
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="compare-overlay" onclick="if(event.target===this)closeCompareView()">
      <div class="compare-panel">
        <div class="compare-header">
          <h3>キャラ間 CG比較</h3>
          ${legendHtml}
          <button class="compare-close" onclick="closeCompareView()">✕</button>
        </div>
        <div class="compare-body">
          ${summaryHtml}
          ${tableHtml}
        </div>
      </div>
    </div>
  `;
}

function closeCompareView() {
  const overlay = document.getElementById('compareOverlay');
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}
