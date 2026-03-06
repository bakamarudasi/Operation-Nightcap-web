/** バトル中の一時的な状態変化 */
export interface Buff {
  id: 'stun' | 'atk_down' | 'dot' | 'no_food' | 'corrupted_hand'
    | 'tipsy' | 'blush' | 'alone' | 'karaoke' | 'dimlight' | 'excuse';
  duration: number;   // -1 = 永続, 1~ = 残りターン数
  value?: number;     // ダメージ量・倍率など
  source?: string;    // 付与元カードID
}

export type CardType = 'drink' | 'food' | 'chug' | 'harassment' | 'strategy' | 'environment' | 'status';
export type CardEffect = 'chug' | 'toast' | 'spill'
  | 'rumor' | 'excuse' | 'distract'
  | 'karaoke' | 'lastorder' | 'dimlight'
  | 'tipsy' | 'blush' | 'alone';

export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  type: CardType;
  damage?: number;
  heal?: number;
  effect?: CardEffect;
  /** 環境カードの持続ターン数 */
  duration?: number;
  enemyDamage?: number;
  selfDamage?: number;
  requiredDrunkLevel?: number;
  drunkDamage?: number;
  instantWin?: boolean;
  /** 理性（サニティ）への直接ダメージ。逆セクハラ等で使用 */
  sanityDamage?: number;
  /** 成功時に対象に付与するバフ/デバフ */
  applyBuffs?: Buff[];
  /** 成功時に自分に付与するバフ/デバフ */
  applySelfBuffs?: Buff[];
  /** 手札汚染: ランダムでN枚を「発情」状態に変える */
  corruptHand?: number;
  description: string;
  rarity: number;
  price: number;
}

export interface CostumeState {
  level: number;
  label: string;
  description: string;
  emoji: string;
  /** CSS用: 衣装崩れの度合い 0.0~1.0 */
  dishevelAmount: number;
}

export interface DrunkLevel {
  level: number;
  name: string;
  threshold: number;
  lines: string[];
}

export interface CGDialogueLine {
  speaker: string;
  text: string;
}

/** CGシーケンスの1フレーム */
export interface CGSequenceFrame {
  /** 画像パス (例: '/cg/blaze_breast_1.png') — 未設定ならプレースホルダー */
  src?: string;
  /** このフレームに対応するdialogue開始インデックス（クリックでセリフが進むと切替） */
  dialogueStart?: number;
  /** フレーム切替時のトランジション */
  transition?: 'fade' | 'slide-left' | 'zoom' | 'none';
  /** プレースホルダーテキスト（画像なし時） */
  label?: string;
}

export interface CGEvent {
  id: string;
  triggerCard: string;
  requiredDrunkLevel: number;
  cgColor: string;
  instantWin?: boolean;
  dialogue: CGDialogueLine[];
  /** 画像シーケンス（段階的演出用） */
  frames?: CGSequenceFrame[];
}

export interface CharacterTheme {
  color: string;
  colorDark: string;
  colorGlow: string;
  icon: string;
  /** 立ち絵画像パス (例: '/characters/blaze/portrait.png')。未設定ならiconにフォールバック */
  portraitImg?: string;
  /** ミニアイコン画像パス。未設定ならiconにフォールバック */
  iconImg?: string;
}

export interface BattleLines {
  playDrink: string[];
  playFood: string[];
  playChug: string[];
  takeDamage: string[];
  dealDamage: string[];
  harassmentSuccess: string[];
  harassmentFail: string[];
  winLine: string;
  loseLine: string;
}

export interface DeckAI {
  personality: 'aggressive' | 'defensive' | 'balanced';
  defaultDeck: string[];
}

export interface AfterEvent {
  id: string;
  /** 解放条件: CG解放率（0~1） */
  requiredCGRate: number;
  /** 解放条件: 最低勝利数 */
  requiredWins: number;
  title: string;
  cgColor: string;
  emoji: string;
  dialogue: CGDialogueLine[];
}

export interface CharacterDef {
  id: string;
  name: string;
  nameEn: string;
  subtitle: string;
  theme: CharacterTheme;
  drunkType: string;
  drunkMax: number;
  drunkLevels: DrunkLevel[];
  costumeStates: CostumeState[];
  battleLines: BattleLines;
  deck_ai: DeckAI;
  cgEvents: CGEvent[];
  afterEvents: AfterEvent[];
}

export type ScreenId = 'title' | 'select' | 'battle' | 'shop' | 'gacha' | 'gallery' | 'settings' | 'deck';

/** ガチャ1回分の排出結果 */
export interface GachaResult {
  cardId: string;
  rarity: number;
  isNew: boolean;
  isDuplicate: boolean;
  refund: number;
}

export interface BattleState {
  round: number;
  maxRounds: number;
  playerDrunk: number;
  opponentDrunk: number;
  playerDeckRemaining: string[];
  opponentDeckRemaining: string[];
  playerHand: string[];
  opponentHand: string[];
  selectedCard: string | null;
  isProcessing: boolean;
  opponentDiscardNext: boolean;
  playerReducedHand: boolean;
  opponentReducedHand: boolean;
  spillActive: boolean;
  /** プレイヤー（ドクター）側のバフ/デバフ */
  playerBuffs: Buff[];
  /** 相手側のバフ/デバフ */
  opponentBuffs: Buff[];
  /** 手札の汚染状態 (カードindex → true で「発情」状態) */
  corruptedSlots: boolean[];
  /** rumor: 次ラウンドの相手手札をランダム差替 */
  rumorActive: boolean;
}

export interface RoundResult {
  playerCard: CardDef;
  opponentCard: CardDef;
  playerDamage: number;
  opponentDamage: number;
  playerHeal: number;
  opponentHeal: number;
  messages: string[];
  cgEvent: CGEvent | null;
  instantWin: boolean;
  spillNullified: boolean;
  /** 相手のセクハラ/逆セクハラで発動するCGイベント */
  opponentCgEvent?: CGEvent | null;
  /** このラウンドで付与されるバフ（プレイヤー側） */
  newPlayerBuffs?: Buff[];
  /** このラウンドで付与されるバフ（相手側） */
  newOpponentBuffs?: Buff[];
  /** 手札汚染数 */
  corruptCount?: number;
}
