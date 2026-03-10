// ============================================================
// Persistence – Save / Load / Undo
// ============================================================

function getDefaults() {
  const info = getCharInfo(currentCharId);
  if (!info) {
    return [
      { id: 'portrait', file: 'portrait.webp', trigger: '基本立ち絵', level: '', type: 'portrait', note: '' },
      { id: 'select-icon', file: 'select-icon.webp', trigger: 'キャラ選択画面用', level: '', type: 'icon', note: '' },
    ];
  }

  const result = [];
  const reverseIds = new Set(reverseHarassCards.map(rc => rc.id));

  for (const ev of info.cgEvents) {
    const isReverse = reverseIds.has(ev.triggerCard);
    const trigger = cardNameCache[ev.triggerCard] || ev.triggerCard;
    const note = ev.instantWin ? 'instant_win' : isReverse ? 'reverse_harassment' : '';
    result.push({
      id: ev.triggerCard,
      gameId: ev.id || '',
      file: ev.triggerCard + '.webp',
      trigger,
      level: 'Lv.' + ev.requiredDrunkLevel,
      type: 'cg',
      note,
      triggerCard: ev.triggerCard,
      cgColor: ev.cgColor || '#e85d3a',
      instantWin: ev.instantWin || false,
      dialogue: ev.dialogue || [],
      frames: ev.frames || [],
    });
  }

  const existingIds = new Set(result.map(i => i.id));
  for (const rc of reverseHarassCards) {
    if (existingIds.has(rc.id)) continue;
    const trigger = (cardNameCache[rc.id] || rc.id);
    result.push({
      id: rc.id,
      file: rc.id + '.webp',
      trigger,
      level: 'Lv.' + rc.requiredDrunkLevel,
      type: 'cg',
      note: 'reverse_harassment',
    });
  }

  result.push({ id: 'portrait', file: 'portrait.webp', trigger: '基本立ち絵', level: '', type: 'portrait', note: '' });
  const drunkLabels = ['素面', 'ほろ酔い', '酔い', 'べろべろ', '潰れ'];
  for (let i = 0; i < info.costumeLevels; i++) {
    result.push({
      id: `portrait-drunk-${i}`,
      file: `portrait-drunk-${i}.webp`,
      trigger: drunkLabels[i] || `酔いLv${i}`,
      level: `Lv.${i}`,
      type: 'portrait',
      note: '',
    });
  }

  result.push({ id: 'select-icon', file: 'select-icon.webp', trigger: 'キャラ選択画面用', level: '', type: 'icon', note: '' });
  return result;
}

function makeItem(def) {
  return {
    ...def,
    status: 'pending',
    history: [],
    feedback: [],
    adoptedImage: null,
    dialogue: def.dialogue || [],
    frames: def.frames || [],
    cgColor: def.cgColor || '#e85d3a',
    instantWin: def.instantWin || false,
    triggerCard: def.triggerCard || def.id || '',
  };
}

// ============================================================
// Character List
// ============================================================

function getCharList() {
  const raw = localStorage.getItem(CHARLIST_KEY);
  if (raw) { try { return JSON.parse(raw); } catch {} }
  return ['blaze'];
}

function saveCharList(list) {
  localStorage.setItem(CHARLIST_KEY, JSON.stringify(list));
}

function loadCharData(id) {
  const raw = localStorage.getItem(STORAGE_PREFIX + id);
  if (raw) { try { return JSON.parse(raw); } catch {} }
  return null;
}

// ============================================================
// Undo
// ============================================================

function pushUndo() {
  const snapshot = localStorage.getItem(STORAGE_PREFIX + currentCharId);
  if (snapshot) {
    undoStack.push({ charId: currentCharId, data: snapshot, selectedId });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
  }
}

async function undo() {
  if (!undoStack.length) { toast('これ以上戻せません', 'err'); return; }
  const entry = undoStack.pop();
  localStorage.setItem(STORAGE_PREFIX + entry.charId, entry.data);
  if (entry.charId !== currentCharId) switchChar(entry.charId);
  else { await load(); renderList(); }
  if (entry.selectedId) { selectedId = entry.selectedId; selectItem(selectedId); }
  toast('元に戻しました');
}

// ============================================================
// Save / Load
// ============================================================

function saveAll() {
  pushUndo();
  const existing = loadCharData(currentCharId);
  const info = getCharInfo(currentCharId);

  const imagePromises = [];
  const serializedItems = items.map(it => {
    const frames = (it.frames || []).map((f, fi) => {
      const frameCopy = { ...f };
      if (f.src && f.src.startsWith('data:')) {
        const key = frameImageKey(currentCharId, it.id, fi);
        imagePromises.push(saveFrameImage(key, f.src));
        frameCopy.src = `idb:${key}`;
      }
      return frameCopy;
    });
    return {
      id: it.id, file: it.file, trigger: it.trigger, level: it.level,
      type: it.type, note: it.note, status: it.status,
      history: it.history, feedback: it.feedback, adoptedImage: it.adoptedImage,
      dialogue: it.dialogue || [], frames,
      cgColor: it.cgColor || '#e85d3a', instantWin: it.instantWin || false,
      triggerCard: it.triggerCard || it.id || '',
    };
  });

  const data = {
    charId: currentCharId,
    charName: existing?.charName || info?.name || '',
    charNameEn: existing?.charNameEn || info?.nameEn || currentCharId.toUpperCase(),
    items: serializedItems,
  };
  localStorage.setItem(STORAGE_PREFIX + currentCharId, JSON.stringify(data));

  if (imagePromises.length) {
    Promise.all(imagePromises).catch(e => console.warn('IndexedDB save failed:', e));
  }
}

async function load() {
  const data = loadCharData(currentCharId);
  if (!data || !data.items?.length) {
    items = getDefaults().map(makeItem);
    return;
  }
  items = data.items.map(s => ({ ...makeItem(s), ...s }));

  for (const item of items) {
    if (!item.frames) continue;
    for (let fi = 0; fi < item.frames.length; fi++) {
      const f = item.frames[fi];
      if (f.src && f.src.startsWith('idb:')) {
        try {
          const dataUrl = await loadFrameImage(f.src.slice(4));
          item.frames[fi].src = dataUrl || null;
        } catch (e) {
          console.warn('Failed to load frame image from IndexedDB:', e);
          item.frames[fi].src = null;
        }
      }
    }
  }

  const defaults = getDefaults();
  const existingIds = new Set(items.map(i => i.id));
  let added = false;
  for (const def of defaults) {
    if (!existingIds.has(def.id)) {
      items.push(makeItem(def));
      added = true;
    } else {
      const item = items.find(i => i.id === def.id);
      if (item && item.type === 'cg') {
        if (!item.dialogue?.length && def.dialogue?.length) item.dialogue = def.dialogue;
        if (!item.frames?.length && def.frames?.length) item.frames = def.frames;
        if (!item.cgColor || item.cgColor === '#e85d3a') item.cgColor = def.cgColor || '#e85d3a';
        if (item.instantWin === undefined) item.instantWin = def.instantWin || false;
        if (!item.triggerCard) item.triggerCard = def.triggerCard || def.id;
      }
    }
  }
  if (added) saveAll();
}
