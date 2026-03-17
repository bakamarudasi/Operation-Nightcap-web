import type { CardType } from '../../data/types.ts';

/** カードタイプの翻訳キー */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  drink: 'cardType.drinkFull',
  food: 'cardType.foodFull',
  chug: 'cardType.chugFull',
  harassment: 'cardType.harassmentFull',
  strategy: 'cardType.strategyFull',
  environment: 'cardType.environmentFull',
  status: 'cardType.statusFull',
};

/** カードタイプの色 (CSSカスタムプロパティと一致) */
export const CARD_TYPE_COLORS: Record<CardType, string> = {
  drink: '#884444',
  food: '#448844',
  chug: '#665588',
  harassment: '#884466',
  strategy: '#556688',
  environment: '#668855',
  status: '#886644',
};
