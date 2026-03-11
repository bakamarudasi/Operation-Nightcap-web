/** バトル中の一時的な状態変化 */
export interface Buff {
  id: 'stun' | 'atk_down' | 'dot' | 'no_food' | 'corrupted_hand'
    | 'tipsy' | 'blush' | 'alone' | 'karaoke' | 'dimlight' | 'excuse'
    | 'drink_dmg_half' | 'next_drink_boost' | 'next_food_boost'
    | 'negate_next' | 'stealth' | 'self_atk_up' | 'all_dmg_up'
    | 'sanity_negate' | 'thorns' | 'reflect_all';
  duration: number;   // -1 = 永続, 1~ = 残りターン数
  value?: number;     // ダメージ量・倍率など
  source?: string;    // 付与元カードID
}

export type CardType = 'drink' | 'food' | 'chug' | 'harassment' | 'strategy' | 'environment' | 'status';
export type CardEffect = 'chug' | 'toast' | 'spill'
  | 'rumor' | 'excuse' | 'distract'
  | 'karaoke' | 'lastorder' | 'dimlight'
  | 'tipsy' | 'blush' | 'alone'
  | 'discard_enemy_hand' | 'swap_drunk' | 'reduce_max_rounds'
  | 'roulette' | 'cleanse' | 'discard_highest' | 'reveal_and_debuff'
  | 'rhodes_party' | 'penguin_vip' | 'babel_requiem' | 'contingency_contract';

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
  /** 自分へのHP回復（攻撃カードが持つ場合ドレイン効果） */
  selfHeal?: number;
  /** 確率分岐ダメージ: [確率, 成功dmg, 失敗自傷dmg] */
  rouletteDmg?: [number, number, number];
  /** 相手の手札をランダムにN枚破棄 */
  discardEnemyHand?: number;
  /** maxRounds減少量 */
  reduceMaxRounds?: number;
  /** デバフ除去数 */
  cleanseSelf?: number;
  /** dot除去 */
  cleanseDot?: boolean;
  /** 双方に付与するバフ（環境カード等） */
  applyBothBuffs?: Buff[];
  /** 相手の手札を公開する */
  revealHand?: boolean;
  /** 酔いLvを入れ替える */
  swapDrunk?: boolean;
  /** 相手の最高dmgカードを破棄 */
  discardHighest?: boolean;
  /** 相手の次ラウンド手札をランダム差替 */
  triggerRumor?: boolean;
  /** ルーレット成功時に即勝利（conviction_luck用） */
  rouletteInstantWin?: boolean;
  /** 相手のバフを全除去し、除去数×1ダメージ（leizi_lightning用） */
  cleanseEnemyBuffs?: boolean;
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
  /** 酔いレベル別立ち絵パス (例: { 0: '/characters/blaze/portrait-drunk-0.webp', 1: '...' }) */
  portraitDrunkImgs?: Record<number, string>;
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
  /** 乾杯強制: 相手の手札1枚ランダム破棄 */
  opponentDiscardNext: boolean;
  /** 相手の効果でプレイヤーの手札を破棄 */
  playerDiscardNext: boolean;
  /** 相手の手札をN枚ランダム破棄（discardEnemyHand用） */
  opponentDiscardCount: number;
  /** プレイヤーの手札をN枚ランダム破棄 */
  playerDiscardCount: number;
  /** 相手の最高dmgカードを破棄 */
  opponentDiscardHighest: boolean;
  /** プレイヤーの最高dmgカードを破棄 */
  playerDiscardHighest: boolean;
  playerReducedHand: boolean;
  opponentReducedHand: boolean;
  spillActive: boolean;
  /** プレイヤー（ドクター）側のバフ/デバフ */
  playerBuffs: Buff[];
  /** 相手側のバフ/デバフ */
  opponentBuffs: Buff[];
  /** 手札の汚染状態 (カードindex → true で「発情」状態) */
  corruptedSlots: boolean[];
  /** 相手の手札の汚染状態 */
  opponentCorruptedSlots: boolean[];
  /** rumor: 次ラウンドの相手手札をランダム差替 */
  rumorActive: boolean;
  /** rumor: 次ラウンドのプレイヤー手札をランダム差替 */
  playerRumorActive: boolean;
  /** 使用済みカードの捨て札（デッキ枯渇時にリシャッフル） */
  playerDiscardPile: string[];
  opponentDiscardPile: string[];
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
