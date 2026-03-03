/**
 * ショップ データ
 */
const SHOP_DATA = {
  closureLines: {
    greeting: [
      'いらっしゃい♪ 今日は何飲む？……あ、飲むんじゃなくて買うのか',
      'おっ、ドクターじゃん。また誰か酔い潰しに行くの？応援するよ〜お代は頂くけど♪',
      'あら〜ドクター♪ 今日も散財しに来た？'
    ],
    buyDrink: [
      'お酒追加ね。いい趣味してる',
      'おっ、攻めるね〜'
    ],
    buyFood: [
      'つまみも大事だよね。賢い賢い',
      '胃に優しくいこうってわけだ'
    ],
    buyChug: [
      '一気飲み！？攻めるねぇ〜、自爆しないようにね',
      'ハイリスクハイリターン、嫌いじゃないよ'
    ],
    buyHarassment: [
      'あらあら〜♪ ドクターも隅に置けないねぇ。うちは何も見てないからね',
      'これ、結構お高いよ？……ま、その価値はあると思うけど♪'
    ],
    insufficient: [
      'お金足りないよ〜。もっと稼いできな！',
      '龍門幣が足りないわね〜。頑張って♪'
    ],
    deckFull: [
      'デッキもう12枚だよ。入れ替えるなら先に抜いてね',
      '12枚MAXだよ〜。どれか外してからね'
    ],
    sell: [
      'はいはい、買い取るよ〜。半額だけどね',
      'リサイクル♪ エコだね〜'
    ]
  },

  // ショップで購入可能なカード一覧
  availableCards: [
    'beer', 'wine', 'whiskey', 'baijiu', 'cocktail',
    'nuts', 'yakitori', 'ramen', 'ukon',
    'chug', 'toast', 'spill',
    'shoulder_lean', 'headpat', 'gaze', 'lap_pillow', 'kiss'
  ]
};

/**
 * カード種別に対応するクロージャのセリフカテゴリ取得
 */
function getShopLineCategory(cardId) {
  const card = CARD_DATA[cardId];
  if (!card) return 'buyDrink';
  switch (card.type) {
    case 'drink': return 'buyDrink';
    case 'food': return 'buyFood';
    case 'chug': return 'buyChug';
    case 'harassment': return 'buyHarassment';
    default: return 'buyDrink';
  }
}
