import { CARD_DATA } from './cards.ts';

export const SHOP_DATA = {
  closureLines: {
    greeting: ['shopNpc.greeting.0', 'shopNpc.greeting.1', 'shopNpc.greeting.2'],
    buyDrink: ['shopNpc.buyDrink.0', 'shopNpc.buyDrink.1'],
    buyFood: ['shopNpc.buyFood.0', 'shopNpc.buyFood.1'],
    buyChug: ['shopNpc.buyChug.0', 'shopNpc.buyChug.1'],
    buyHarassment: ['shopNpc.buyHarassment.0', 'shopNpc.buyHarassment.1'],
    insufficient: ['shopNpc.insufficient.0', 'shopNpc.insufficient.1'],
    deckFull: ['shopNpc.deckFull.0', 'shopNpc.deckFull.1'],
    sell: ['shopNpc.sell.0', 'shopNpc.sell.1'],
    cardLimit: ['shopNpc.cardLimit.0', 'shopNpc.cardLimit.1'],
    buyStrategy: ['shopNpc.buyStrategy.0', 'shopNpc.buyStrategy.1'],
    buyEnvironment: ['shopNpc.buyEnvironment.0', 'shopNpc.buyEnvironment.1'],
    buyStatus: ['shopNpc.buyStatus.0', 'shopNpc.buyStatus.1'],
  },

  availableCards: [
    'beer', 'wine', 'whiskey', 'baijiu', 'cocktail',
    'nuts', 'yakitori', 'ramen', 'ukon',
    'chug', 'toast', 'spill',
    'shoulder_lean', 'headpat', 'kiss',
    // 新規アークナイツカード
    'iberia_dark_rum', 'minos_blood_wine',
    'lungmen_hotpot', 'kjerag_fondue',
    'penguin_bomb', 'kazimierz_duel',
    'chen_holungday', 'amiya_inspiration',
    'back_hug', 'forehead_kiss'
  ]
} as const;

export function getShopLineCategory(cardId: string): keyof typeof SHOP_DATA.closureLines {
  const card = CARD_DATA[cardId];
  if (!card) return 'buyDrink';
  switch (card.type) {
    case 'drink': return 'buyDrink';
    case 'food': return 'buyFood';
    case 'chug': return 'buyChug';
    case 'harassment': return 'buyHarassment';
    case 'strategy': return 'buyStrategy';
    case 'environment': return 'buyEnvironment';
    case 'status': return 'buyStatus';
    default: return 'buyDrink';
  }
}
