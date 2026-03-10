// ============================================================
// ゲームコード (characters.ts + cards.ts) からCG要件を動的取得
// ============================================================

// File System Access API でプロジェクト内のファイルを読む
async function readFileViaHandle(relativePath) {
  if (!projectDirHandle) return null;
  try {
    const parts = relativePath.split('/').filter(Boolean);
    let dir = projectDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch { return null; }
}

async function fetchGameData() {
  if (charDataCache) return;
  charDataCache = {};

  let charSrc = null, cardSrc = null;

  // 1. fetch で取得（HTTPサーバー経由 — file://プロトコル時はCORSエラーになるためスキップ）
  if (location.protocol !== 'file:') {
    try {
      const [charRes, cardRes] = await Promise.all([
        fetch('../src/data/characters.ts?t=' + Date.now()),
        fetch('../src/data/cards.ts?t=' + Date.now()),
      ]);
      if (charRes.ok) charSrc = await charRes.text();
      if (cardRes.ok) cardSrc = await cardRes.text();
    } catch {}
  }

  // 2. File System Access API で取得（フォルダ設定済みの場合）
  if (!charSrc && projectDirHandle) {
    charSrc = await readFileViaHandle('src/data/characters.ts');
  }
  if (!cardSrc && projectDirHandle) {
    cardSrc = await readFileViaHandle('src/data/cards.ts');
  }

  // 3. インライン埋め込みデータで取得（file://プロトコル用フォールバック）
  if (!charSrc && typeof EMBEDDED_CHARACTERS_SRC !== 'undefined') {
    charSrc = EMBEDDED_CHARACTERS_SRC;
  }
  if (!cardSrc && typeof EMBEDDED_CARDS_SRC !== 'undefined') {
    cardSrc = EMBEDDED_CARDS_SRC;
  }

  if (charSrc) parseCharacters(charSrc);
  if (cardSrc) parseCards(cardSrc);
}

function extractCGEventBlocks(cgBlock) {
  const blocks = [];
  let depth = 0, start = -1;
  for (let i = 0; i < cgBlock.length; i++) {
    if (cgBlock[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (cgBlock[i] === '}') { depth--; if (depth === 0 && start >= 0) { blocks.push(cgBlock.slice(start, i + 1)); start = -1; } }
  }
  return blocks;
}

function extractBalancedArrayContent(src, key) {
  const idx = src.indexOf(key);
  if (idx < 0) return null;
  const bracketStart = src.indexOf('[', idx + key.length);
  if (bracketStart < 0) return null;
  let depth = 0;
  for (let i = bracketStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) return src.slice(bracketStart + 1, i); }
  }
  return null;
}

function extractBalancedBlock(src, startPos) {
  let depth = 0;
  let start = -1;
  for (let i = startPos; i < src.length; i++) {
    if (src[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function parseCharacters(src) {
  const charBlockRe = /^\s{2}(\w+):\s*\{/gm;
  let match;
  const charStarts = [];
  while ((match = charBlockRe.exec(src)) !== null) {
    charStarts.push({ id: match[1], pos: match.index });
  }

  for (let ci = 0; ci < charStarts.length; ci++) {
    const charId = charStarts[ci].id;
    const start = charStarts[ci].pos;
    const end = ci + 1 < charStarts.length ? charStarts[ci + 1].pos : src.length;
    const block = src.slice(start, end);

    const nameM = block.match(/name:\s*'([^']+)'/);
    const nameEnM = block.match(/nameEn:\s*'([^']+)'/);

    const cgEvents = [];
    const cgBlockContent = extractBalancedArrayContent(block, 'cgEvents:');
    if (cgBlockContent) {
      const parsedEvents = extractCGEventBlocks(cgBlockContent);
      for (const evBlock of parsedEvents) {
        const tcM = evBlock.match(/triggerCard:\s*'([^']+)'/);
        const dlM = evBlock.match(/requiredDrunkLevel:\s*(\d+)/);
        const iwM = evBlock.match(/instantWin:\s*true/);
        const ccM = evBlock.match(/cgColor:\s*'([^']*)'/);
        const idM = evBlock.match(/id:\s*'([^']+)'/);
        if (!tcM) continue;

        const dialogue = [];
        const dlgRe = /\{\s*speaker:\s*'((?:[^'\\]|\\.)*)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
        let dm;
        while ((dm = dlgRe.exec(evBlock)) !== null) {
          dialogue.push({ speaker: dm[1], text: dm[2] });
        }

        const frames = [];
        const framesM = evBlock.match(/frames:\s*\[([\s\S]*?)\]/);
        if (framesM) {
          const fRe = /\{([^}]*)\}/g;
          let fm;
          while ((fm = fRe.exec(framesM[1])) !== null) {
            const fb = fm[1];
            frames.push({
              label: fb.match(/label:\s*'([^']*)'/) ?.[1] || '',
              dialogueStart: parseInt(fb.match(/dialogueStart:\s*(\d+)/)?.[1] || '0'),
              transition: fb.match(/transition:\s*'([^']*)'/) ?.[1] || 'fade',
              src: fb.match(/src:\s*'([^']*)'/) ?.[1] || null,
            });
          }
        }

        cgEvents.push({
          id: idM?.[1] || '',
          triggerCard: tcM[1],
          requiredDrunkLevel: parseInt(dlM?.[1] || '0'),
          instantWin: !!iwM,
          cgColor: ccM?.[1] || '#e85d3a',
          dialogue,
          frames,
        });
      }
    }

    const costumeCount = (block.match(/level:\s*\d+.*?dishevelAmount/g) || []).length;
    const costumeStates = [];
    const csBlockContent = extractBalancedArrayContent(block, 'costumeStates:');
    if (csBlockContent) {
      const csBlocks = extractCGEventBlocks(csBlockContent);
      for (const csb of csBlocks) {
        costumeStates.push({
          level: parseInt(csb.match(/level:\s*(\d+)/)?.[1] || '0'),
          label: csb.match(/label:\s*'([^']*)'/)?.[1] || '',
          description: csb.match(/description:\s*'([^']*)'/)?.[1] || '',
          dishevelAmount: parseFloat(csb.match(/dishevelAmount:\s*([\d.]+)/)?.[1] || '0'),
        });
      }
    }

    const afterEvents = [];
    const aeBlockContent = extractBalancedArrayContent(block, 'afterEvents:');
    if (aeBlockContent) {
      const aeBlocks = extractCGEventBlocks(aeBlockContent);
      for (const aeb of aeBlocks) {
        const aeDialogue = [];
        const dlgRe2 = /\{\s*speaker:\s*'((?:[^'\\]|\\.)*)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
        let dm2;
        while ((dm2 = dlgRe2.exec(aeb)) !== null) {
          aeDialogue.push({ speaker: dm2[1], text: dm2[2] });
        }
        afterEvents.push({
          id: aeb.match(/id:\s*'([^']*)'/)?.[1] || '',
          title: aeb.match(/title:\s*'([^']*)'/)?.[1] || '',
          requiredCGRate: parseFloat(aeb.match(/requiredCGRate:\s*([\d.]+)/)?.[1] || '0'),
          requiredWins: parseInt(aeb.match(/requiredWins:\s*(\d+)/)?.[1] || '0'),
          cgColor: aeb.match(/cgColor:\s*'([^']*)'/)?.[1] || '#e85d3a',
          dialogue: aeDialogue,
        });
      }
    }

    const themeIdx = block.indexOf('theme:');
    let themeColorM = null;
    if (themeIdx >= 0) {
      const themeSlice = block.slice(themeIdx, themeIdx + 200);
      const cm = themeSlice.match(/color:\s*'(#[^']+)'/);
      if (cm) themeColorM = cm;
    }

    charDataCache[charId] = {
      name: nameM?.[1] || '',
      nameEn: nameEnM?.[1] || charId.toUpperCase(),
      cgEvents,
      costumeLevels: costumeCount,
      costumeStates,
      afterEvents,
      theme: { color: themeColorM?.[1] || '#e85d3a' },
    };
  }
}

function parseCards(src) {
  const re = /id:\s*'([^']+)',\s*name:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    cardNameCache[m[1]] = m[2];
  }

  reverseHarassCards = [];
  const blockRe = /(\w+):\s*\{[^}]*id:\s*'([^']+)'[^}]*type:\s*'harassment'[^}]*requiredDrunkLevel:\s*(\d+)[^}]*sanityDamage:\s*(\d+)/g;
  let bm;
  while ((bm = blockRe.exec(src)) !== null) {
    reverseHarassCards.push({ id: bm[2], requiredDrunkLevel: parseInt(bm[3]) });
  }
}

function getCharInfo(charId) {
  return charDataCache?.[charId] || null;
}

// characters.ts の生ソースコードを取得
async function fetchCharSourceRaw() {
  if (charSourceRaw) return charSourceRaw;
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch('../src/data/characters.ts?t=' + Date.now());
      if (res.ok) charSourceRaw = await res.text();
    } catch {}
  }
  if (!charSourceRaw && projectDirHandle) {
    charSourceRaw = await readFileViaHandle('src/data/characters.ts');
  }
  if (!charSourceRaw && typeof EMBEDDED_CHARACTERS_SRC !== 'undefined') {
    charSourceRaw = EMBEDDED_CHARACTERS_SRC;
  }
  return charSourceRaw;
}

function extractCGEventData(charId, triggerCard) {
  if (!charSourceRaw) return null;

  const charRe = new RegExp(`\\b${charId}:\\s*\\{`, 'g');
  const charMatch = charRe.exec(charSourceRaw);
  if (!charMatch) return null;

  const afterChar = charSourceRaw.slice(charMatch.index);
  const cgEventsStart = afterChar.indexOf('cgEvents:');
  if (cgEventsStart < 0) return null;

  const triggerRe = new RegExp(`\\{[\\s\\S]*?triggerCard:\\s*'${triggerCard}'[\\s\\S]*?\\}\\s*,?\\s*(?:\\{|\\])`, 'g');
  const afterCgEvents = afterChar.slice(cgEventsStart);
  const triggerMatch = triggerRe.exec(afterCgEvents);
  if (!triggerMatch) return null;

  const eventStart = afterCgEvents.indexOf(triggerMatch[0]);
  let eventBlock = extractBalancedBlock(afterCgEvents, eventStart);
  if (!eventBlock) return null;

  const dialogue = [];
  const dlgRe = /\{\s*speaker:\s*'((?:[^'\\]|\\.)*)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  let dm;
  while ((dm = dlgRe.exec(eventBlock)) !== null) {
    dialogue.push({ speaker: dm[1], text: dm[2] });
  }

  const frames = [];
  const framesMatch = eventBlock.match(/frames:\s*\[([\s\S]*?)\]/);
  if (framesMatch) {
    const frameRe = /\{([^}]*)\}/g;
    let fm;
    while ((fm = frameRe.exec(framesMatch[1])) !== null) {
      const block = fm[1];
      const label = block.match(/label:\s*'([^']*)'/) ?.[1] || '';
      const dialogueStart = block.match(/dialogueStart:\s*(\d+)/)?.[1];
      const transition = block.match(/transition:\s*'([^']*)'/) ?.[1] || 'fade';
      frames.push({
        label,
        dialogueStart: dialogueStart !== undefined ? parseInt(dialogueStart) : 0,
        transition,
      });
    }
  }

  const colorMatch = eventBlock.match(/cgColor:\s*'([^']*)'/);
  const cgColor = colorMatch ? colorMatch[1] : '#e85d3a';

  return { dialogue, frames, cgColor };
}
