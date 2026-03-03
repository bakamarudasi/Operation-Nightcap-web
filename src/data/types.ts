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

export interface CGEvent {
  id: string;
  triggerCard: string;
  requiredDrunkLevel: number;
  cgColor: string;
  instantWin?: boolean;
  image?: string;
  dialogue: CGDialogueLine[];
}

export interface CharacterTheme {
  color: string;
  colorDark: string;
  colorGlow: string;
  icon: string;
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

export interface CharacterDef {
  id: string;
  name: string;
  nameEn: string;
  subtitle: string;
  theme: CharacterTheme;
  drunkType: string;
  drunkMax: number;
  drunkLevels: DrunkLevel[];
  battleLines: BattleLines;
  deck_ai: DeckAI;
  cgEvents: CGEvent[];
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
