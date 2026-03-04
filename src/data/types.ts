export interface CardDef {
  id: string;
  name: string;
  emoji: string;
  type: 'drink' | 'food' | 'chug' | 'harassment';
  damage?: number;
  heal?: number;
  effect?: 'chug' | 'toast' | 'spill';
  enemyDamage?: number;
  selfDamage?: number;
  requiredDrunkLevel?: number;
  drunkDamage?: number;
  instantWin?: boolean;
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

export type ScreenId = 'title' | 'select' | 'battle' | 'shop' | 'gallery' | 'settings';

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
}
