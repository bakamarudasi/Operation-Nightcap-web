/**
 * CGイベントシステム
 */
const CGSystem = {
  currentDialogue: null,
  currentDialogueIndex: 0,
  onComplete: null,

  /**
   * CGイベント再生
   */
  play(cgEvent, onComplete) {
    this.currentDialogue = cgEvent.dialogue;
    this.currentDialogueIndex = 0;
    this.onComplete = onComplete;

    const overlay = document.getElementById('cg-overlay');
    const cgImage = document.getElementById('cg-image');
    const cgTextbox = document.getElementById('cg-textbox');

    // CG画像の代わりにカラー背景 + キャラ名表示
    cgImage.style.background = `linear-gradient(135deg, ${cgEvent.cgColor || '#e85d3a'}44, ${cgEvent.cgColor || '#e85d3a'}88)`;
    cgImage.innerHTML = `<div class="cg-placeholder">
      <div class="cg-placeholder-emoji">${this.getEventEmoji(cgEvent)}</div>
      <div class="cg-placeholder-text">${cgEvent.id.replace(/_/g, ' ').toUpperCase()}</div>
    </div>`;

    overlay.classList.remove('hidden');
    overlay.classList.add('cg-flash');
    setTimeout(() => overlay.classList.remove('cg-flash'), 300);

    this.showDialogueLine();

    // クリックで次へ
    overlay.onclick = () => this.advance();
  },

  /**
   * イベントの絵文字取得
   */
  getEventEmoji(cgEvent) {
    const card = CARD_DATA[cgEvent.triggerCard];
    return card ? card.emoji : '💫';
  },

  /**
   * セリフ表示（タイプライター）
   */
  showDialogueLine() {
    if (this.currentDialogueIndex >= this.currentDialogue.length) {
      this.close();
      return;
    }

    const line = this.currentDialogue[this.currentDialogueIndex];
    const speakerEl = document.getElementById('cg-speaker');
    const textEl = document.getElementById('cg-text');

    speakerEl.textContent = line.speaker;
    textEl.textContent = '';

    // タイプライター効果
    let i = 0;
    const chars = line.text.split('');
    const typeInterval = setInterval(() => {
      if (i < chars.length) {
        textEl.textContent += chars[i];
        i++;
      } else {
        clearInterval(typeInterval);
      }
    }, 30);

    // 途中クリックで全文表示
    this._typeInterval = typeInterval;
    this._fullText = line.text;
  },

  /**
   * 次のセリフへ / CG終了
   */
  advance() {
    // タイプライター途中なら全文表示
    if (this._typeInterval) {
      clearInterval(this._typeInterval);
      this._typeInterval = null;
      document.getElementById('cg-text').textContent = this._fullText;
      return;
    }

    this.currentDialogueIndex++;
    if (this.currentDialogueIndex >= this.currentDialogue.length) {
      this.close();
    } else {
      this.showDialogueLine();
    }
  },

  /**
   * CG閉じる
   */
  close() {
    const overlay = document.getElementById('cg-overlay');
    overlay.classList.add('cg-fadeout');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('cg-fadeout');
      overlay.onclick = null;
      if (this.onComplete) this.onComplete();
    }, 500);
  },

  /**
   * ギャラリーからCGを再生
   */
  playFromGallery(characterId, cgEventId) {
    const char = CHARACTER_DATA[characterId];
    if (!char) return;
    const cgEvent = char.cgEvents.find(e => e.id === cgEventId);
    if (!cgEvent) return;
    this.play(cgEvent, null);
  }
};
