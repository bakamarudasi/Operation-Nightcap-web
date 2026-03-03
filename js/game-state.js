/**
 * ゲーム状態管理
 */
const GameState = {
  money: 3200,
  playerDeck: [...DEFAULT_DECK],
  unlockedCGs: new Set(),
  currentOpponent: null,
  wins: 0,
  losses: 0,

  // バトル中の状態
  battle: {
    round: 0,
    maxRounds: 12,
    playerDrunk: 0,
    opponentDrunk: 0,
    playerDeckRemaining: [],
    opponentDeckRemaining: [],
    playerHand: [],
    opponentHand: [],
    selectedCard: null,
    isProcessing: false,
    // 特殊効果状態
    opponentDiscardNext: false,  // 乾杯強制の効果
    playerReducedHand: false,    // こぼしの効果
    spillActive: false           // こぼしで相手カード無効化
  },

  /**
   * セーブ
   */
  save() {
    const data = {
      money: this.money,
      playerDeck: this.playerDeck,
      unlockedCGs: [...this.unlockedCGs],
      wins: this.wins,
      losses: this.losses
    };
    try {
      localStorage.setItem('closures_bar_save', JSON.stringify(data));
    } catch (e) {
      // localStorage unavailable
    }
  },

  /**
   * ロード
   */
  load() {
    try {
      const raw = localStorage.getItem('closures_bar_save');
      if (!raw) return;
      const data = JSON.parse(raw);
      this.money = data.money ?? 3200;
      this.playerDeck = data.playerDeck ?? [...DEFAULT_DECK];
      this.unlockedCGs = new Set(data.unlockedCGs ?? []);
      this.wins = data.wins ?? 0;
      this.losses = data.losses ?? 0;
    } catch (e) {
      // parse error, use defaults
    }
  },

  /**
   * バトル初期化
   */
  initBattle(opponentId) {
    const char = CHARACTER_DATA[opponentId];
    if (!char) return;
    this.currentOpponent = char;
    this.battle.round = 0;
    this.battle.maxRounds = 12;
    this.battle.playerDrunk = 0;
    this.battle.opponentDrunk = 0;
    this.battle.playerDeckRemaining = [...this.playerDeck];
    this.battle.opponentDeckRemaining = [...char.deck_ai.defaultDeck];
    this.battle.playerHand = [];
    this.battle.opponentHand = [];
    this.battle.selectedCard = null;
    this.battle.isProcessing = false;
    this.battle.opponentDiscardNext = false;
    this.battle.playerReducedHand = false;
    this.battle.spillActive = false;
    // シャッフル
    shuffleArray(this.battle.playerDeckRemaining);
    shuffleArray(this.battle.opponentDeckRemaining);
  },

  /**
   * 酔いレベル取得
   */
  getDrunkLevel(drunkValue) {
    if (drunkValue >= 10) return 4;
    if (drunkValue >= 7) return 3;
    if (drunkValue >= 4) return 2;
    if (drunkValue >= 2) return 1;
    return 0;
  },

  /**
   * 酔いレベル情報取得
   */
  getDrunkLevelInfo(drunkValue, character) {
    const level = this.getDrunkLevel(drunkValue);
    if (!character) return { level, name: '', lines: [] };
    const levelData = character.drunkLevels.find(l => l.level === level);
    return levelData || { level, name: '???', lines: [] };
  }
};

/**
 * 配列シャッフル（Fisher-Yates）
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * ランダム選択
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
