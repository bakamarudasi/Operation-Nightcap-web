import type { CardType } from '../../data/types.ts';

/** カードタイプの日本語ラベル */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  drink: 'ドリンク',
  food: 'つまみ',
  chug: '一気飲み',
  harassment: 'セクハラ',
  strategy: '戦略',
  environment: '環境',
  status: '状態異常',
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
