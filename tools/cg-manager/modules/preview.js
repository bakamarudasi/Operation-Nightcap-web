// ============================================================
// Game Preview (CGOverlay recreation)
// ============================================================

async function openGamePreview() {
  const item = items.find(i => i.id === selectedId);
  if (!item || item.type !== 'cg') return;

  let eventData = null;
  if (item.dialogue?.length) {
    eventData = { dialogue: item.dialogue, frames: item.frames || [], cgColor: item.cgColor || '#e85d3a' };
  } else {
    await fetchCharSourceRaw();
    eventData = extractCGEventData(currentCharId, item.id);
  }

  if (!eventData || eventData.dialogue.length === 0) {
    toast('このCGのセリフデータが見つかりません', 'err');
    return;
  }

  const imgSrc = getThumbSrc(item);

  gpState = {
    dialogue: eventData.dialogue,
    frames: eventData.frames,
    cgColor: eventData.cgColor,
    imgSrc,
    currentLine: 0,
    currentFrame: 0,
    displayText: '',
    isTyping: false,
    typeTimer: null,
  };

  renderGamePreview();
  document.getElementById('gamePreviewOverlay').style.display = 'block';
  startTyping();
}

function renderGamePreview() {
  if (!gpState) return;
  const { dialogue, frames, cgColor, imgSrc, currentLine, currentFrame, displayText } = gpState;
  const line = dialogue[currentLine];
  if (!line) return;

  const hasFrames = frames && frames.length > 0;
  let imageHtml = '';

  if (hasFrames) {
    const frame = frames[currentFrame];
    const frameLabel = frame?.label || '';
    const frameImgSrc = frame?.src || imgSrc;
    let dotsHtml = '';
    if (frames.length > 1) {
      dotsHtml = '<div class="gp-frame-dots">';
      for (let i = 0; i < frames.length; i++) {
        const cls = i === currentFrame ? 'active' : i < currentFrame ? 'passed' : '';
        dotsHtml += `<div class="gp-dot ${cls}"></div>`;
      }
      dotsHtml += '</div>';
    }

    if (frameImgSrc) {
      imageHtml = `
        <div class="gp-image">
          <div class="gp-seq-frame gp-seq-enter-fade" style="background:url('${frameImgSrc}') center/cover no-repeat; width:100%; height:100%;">
          </div>
          ${dotsHtml}
        </div>`;
    } else {
      imageHtml = `
        <div class="gp-image">
          <div class="gp-seq-frame gp-seq-enter-fade" style="background:linear-gradient(135deg, ${cgColor}44, ${cgColor}88); width:100%; height:100%;">
            <div class="gp-placeholder">
              <div style="font-size:80px">🎨</div>
              <div style="font-size:16px;color:#f5e6d3">${esc(frameLabel)}</div>
            </div>
          </div>
          ${dotsHtml}
        </div>`;
    }
  } else {
    if (imgSrc) {
      imageHtml = `<div class="gp-image"><img src="${imgSrc}" alt="CG"></div>`;
    } else {
      imageHtml = `
        <div class="gp-image" style="background:linear-gradient(135deg, ${cgColor}44, ${cgColor}88)">
          <div class="gp-placeholder">
            <div style="font-size:80px">🎨</div>
            <div style="font-size:16px;color:#f5e6d3"></div>
          </div>
        </div>`;
    }
  }

  const overlay = document.getElementById('gamePreviewOverlay');
  overlay.innerHTML = `
    <div class="game-preview-overlay" onclick="handlePreviewClick(event)">
      <button class="gp-close" onclick="event.stopPropagation();closeGamePreview()">✕</button>
      <div class="gp-progress">${currentLine + 1} / ${dialogue.length}</div>
      ${imageHtml}
      <div class="gp-textbox">
        <div class="gp-speaker">${esc(line.speaker)}</div>
        <div class="gp-text" id="gpText">${esc(displayText)}</div>
        <div class="gp-next">▶ クリックで次へ</div>
      </div>
    </div>
  `;
}

function startTyping() {
  if (!gpState) return;
  const line = gpState.dialogue[gpState.currentLine];
  if (!line) return;

  gpState.displayText = '';
  gpState.isTyping = true;
  let i = 0;
  const chars = line.text.split('');

  gpState.typeTimer = setInterval(() => {
    if (i < chars.length) {
      gpState.displayText += chars[i];
      i++;
      const el = document.getElementById('gpText');
      if (el) el.textContent = gpState.displayText;
    } else {
      clearInterval(gpState.typeTimer);
      gpState.typeTimer = null;
      gpState.isTyping = false;
    }
  }, 30);
}

function handlePreviewClick(e) {
  if (e.target.closest('.gp-close')) return;
  if (!gpState) return;

  if (gpState.isTyping) {
    clearInterval(gpState.typeTimer);
    gpState.typeTimer = null;
    gpState.isTyping = false;
    const line = gpState.dialogue[gpState.currentLine];
    gpState.displayText = line.text;
    const el = document.getElementById('gpText');
    if (el) el.textContent = gpState.displayText;
  } else {
    gpState.currentLine++;
    if (gpState.currentLine >= gpState.dialogue.length) {
      closeGamePreview();
      return;
    }

    if (gpState.frames && gpState.frames.length > 0) {
      const newFrame = findLastIndex(gpState.frames, f =>
        f.dialogueStart !== undefined && f.dialogueStart <= gpState.currentLine
      );
      if (newFrame >= 0 && newFrame !== gpState.currentFrame) {
        gpState.currentFrame = newFrame;
      }
    }

    renderGamePreview();
    startTyping();
  }
}

function closeGamePreview() {
  if (gpState?.typeTimer) clearInterval(gpState.typeTimer);
  gpState = null;
  const overlay = document.getElementById('gamePreviewOverlay');
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}
