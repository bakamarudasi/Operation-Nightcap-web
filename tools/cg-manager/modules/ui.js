// ============================================================
// CG List / Grid Rendering
// ============================================================

function renderList() {
  const list = document.getElementById('cgList');
  list.innerHTML = '';
  const filtered = items.filter(i => {
    if (filter === 'all') return true;
    if (filter === 'pending') return i.status === 'pending';
    if (filter === 'review') return i.status === 'review';
    if (filter === 'done') return i.status === 'done';
    return true;
  });

  if (viewMode === 'grid') { renderGrid(filtered); return; }

  const groups = { cg: [], portrait: [], icon: [] };
  for (const i of filtered) (groups[i.type] || groups.cg).push(i);

  const labels = { cg: 'イベントCG', portrait: '立ち絵', icon: 'アイコン' };
  for (const [type, arr] of Object.entries(groups)) {
    if (arr.length === 0 && filter !== 'all') continue;
    const hdr = document.createElement('div');
    hdr.className = 'group-hdr';
    const addAction = type === 'cg' ? `showNewEventModal()` : `addItem('${type}')`;
    hdr.innerHTML = `<span>${labels[type]} (${arr.length})</span><button class="sm" onclick="${addAction}">+ 追加</button>`;
    list.appendChild(hdr);

    for (const item of arr) {
      const isReverse = item.note === 'reverse_harassment';
      const card = document.createElement('div');
      card.className = 'cg-card' + (item.id === selectedId ? ' selected' : '') + (isReverse ? ' reverse-card' : '');
      card.onclick = () => selectItem(item.id);

      const badgeCls = { pending: 'pending', review: 'review', done: 'done' }[item.status] || 'pending';
      const badgeText = { pending: '未作成', review: 'レビュー', done: '採用済' }[item.status] || '未作成';
      const feDot = fileExistence[item.id] === true ? 'exists' : fileExistence[item.id] === false ? 'missing' : 'unknown';
      const reverseTag = isReverse ? ' <span class="badge reverse">&#x1F525; 逆セクハラ</span>' : '';

      card.innerHTML = `
        <div class="cg-top">
          <span>${esc(item.trigger)}${reverseTag}</span>
          <span class="badge ${badgeCls}">${badgeText}</span>
        </div>
        <div class="cg-bot">
          <span class="file-dot ${feDot}"></span>
          ${esc(item.file)} ${item.level ? '/ ' + item.level : ''}
        </div>
        <button class="sm danger del-btn" onclick="event.stopPropagation();removeItem('${esc(item.id)}')">✕</button>
      `;
      list.appendChild(card);
    }
  }
}

function renderGrid(filtered) {
  const container = document.getElementById('cgList');
  container.innerHTML = '';
  container.className = 'cg-list';

  const groups = { cg: [], portrait: [], icon: [] };
  for (const i of filtered) (groups[i.type] || groups.cg).push(i);

  const labels = { cg: 'イベントCG', portrait: '立ち絵', icon: 'アイコン' };
  const grid = document.createElement('div');
  grid.className = 'cg-grid';

  for (const [type, arr] of Object.entries(groups)) {
    if (arr.length === 0 && filter !== 'all') continue;
    const hdr = document.createElement('div');
    hdr.className = 'group-hdr';
    hdr.innerHTML = `<span>${labels[type]} (${arr.length})</span>`;
    grid.appendChild(hdr);

    for (const item of arr) {
      const isReverse = item.note === 'reverse_harassment';
      const card = document.createElement('div');
      card.className = 'cg-grid-card' + (item.id === selectedId ? ' selected' : '') + (isReverse ? ' reverse-card' : '');
      card.onclick = () => selectItem(item.id);

      const badgeCls = { pending: 'pending', review: 'review', done: 'done' }[item.status] || 'pending';
      const badgeText = { pending: '未', review: 'レ', done: '済' }[item.status] || '未';

      const thumbSrc = getThumbSrc(item);
      const thumbContent = thumbSrc
        ? `<img src="${thumbSrc}" alt="${esc(item.trigger)}">`
        : (item.type === 'cg' ? '🎨' : item.type === 'portrait' ? '🖼' : '👤');

      card.innerHTML = `
        <div class="cg-grid-thumb">${thumbContent}</div>
        <div class="cg-grid-info">${esc(item.trigger)}</div>
        <span class="cg-grid-badge ${badgeCls}">${badgeText}</span>
      `;
      grid.appendChild(card);
    }
  }
  container.appendChild(grid);
}

function updateCounts() {
  const p = items.filter(i => i.status === 'pending').length;
  const r = items.filter(i => i.status === 'review').length;
  const d = items.filter(i => i.status === 'done').length;
  document.getElementById('cntP').textContent = p;
  document.getElementById('cntR').textContent = r;
  document.getElementById('cntD').textContent = d;
  document.getElementById('cntA').textContent = items.length;
  document.getElementById('cntAT').textContent = items.length;
  document.getElementById('cntPT').textContent = p;
  document.getElementById('cntRT').textContent = r;
  document.getElementById('cntDT').textContent = d;
}

function setFilter(f) {
  filter = f;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
  renderList();
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  renderList();
}
