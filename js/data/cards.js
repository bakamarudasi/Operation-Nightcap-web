/**
 * カード定義データ
 */
const CARD_DATA = {
  // === ドリンクカード（攻撃） ===
  beer: {
    id: 'beer', name: 'ビール', emoji: '🍺', type: 'drink',
    damage: 1, description: '安定の軽い一杯', rarity: 1, price: 100
  },
  wine: {
    id: 'wine', name: 'ワイン', emoji: '🍷', type: 'drink',
    damage: 2, description: 'バランス型', rarity: 2, price: 300
  },
  whiskey: {
    id: 'whiskey', name: 'ウイスキー', emoji: '🥃', type: 'drink',
    damage: 3, description: '重い一撃', rarity: 3, price: 500
  },
  baijiu: {
    id: 'baijiu', name: '白酒', emoji: '🍶', type: 'drink',
    damage: 4, description: '中国酒。最強のドリンク', rarity: 4, price: 800
  },
  cocktail: {
    id: 'cocktail', name: 'カクテル', emoji: '🧊', type: 'drink',
    damage: -1, // -1 = ランダム(1~3)
    description: 'ランダムダメージ（ロシアンルーレット感）', rarity: 2, price: 400
  },

  // === つまみカード（防御・回復） ===
  nuts: {
    id: 'nuts', name: 'ナッツ', emoji: '🥜', type: 'food',
    heal: 1, description: '軽いつまみ', rarity: 1, price: 100
  },
  yakitori: {
    id: 'yakitori', name: '焼き鳥', emoji: '🍖', type: 'food',
    heal: 2, description: 'がっつり系', rarity: 2, price: 300
  },
  ramen: {
    id: 'ramen', name: 'ラーメン', emoji: '🍜', type: 'food',
    heal: 3, description: '〆の一杯。大回復', rarity: 3, price: 600
  },
  ukon: {
    id: 'ukon', name: 'ウコン', emoji: '💊', type: 'food',
    heal: 99, description: 'クロージャ限定販売。ぶっ壊れ', rarity: 5, price: 1200
  },

  // === 一気飲みカード（ハイリスク） ===
  chug: {
    id: 'chug', name: '一気飲み', emoji: '🍻', type: 'chug',
    effect: 'chug', enemyDamage: 3, selfDamage: 1,
    description: '相手に酔い3ダメージ、自分にも酔い1ダメージ', rarity: 3, price: 800
  },
  toast: {
    id: 'toast', name: '乾杯強制', emoji: '🥂', type: 'chug',
    effect: 'toast', enemyDamage: 2, selfDamage: 1,
    description: '相手に酔い2ダメージ+次ラウンド相手の手札1枚破棄、自分も酔い1ダメージ',
    rarity: 3, price: 700
  },
  spill: {
    id: 'spill', name: 'こぼし', emoji: '🫗', type: 'chug',
    effect: 'spill',
    description: '相手の出したカード無効化。次ラウンド自分の手札が3枚に減る',
    rarity: 2, price: 500
  },

  // === アークナイツ特化ドリンク（攻撃） ===
  originium_cocktail: {
    id: 'originium_cocktail', name: '源石カクテル', emoji: '☢️', type: 'drink',
    damage: 3, description: '「鉱石病が進む味がする」源石粉末入り。飲んだ後もジワジワ蝕む', rarity: 4, price: 850
  },
  lungmen_baijiu: {
    id: 'lungmen_baijiu', name: '龍門老酒・裏ラベル', emoji: '🐉', type: 'drink',
    damage: 4, description: 'チェンが隠してる私物。強烈すぎて注いだ方も一瞬固まる', rarity: 4, price: 900
  },
  absinthe_tears: {
    id: 'absinthe_tears', name: 'アブサントの涙', emoji: '💧', type: 'drink',
    damage: 2, description: 'アブサント（オペ）の名前を冠した青い蒸留酒。飲むと涙腺が緩む', rarity: 3, price: 550
  },
  sami_aurora: {
    id: 'sami_aurora', name: 'サーミ・オーロラ', emoji: '🌌', type: 'drink',
    damage: 3, description: '極北の夜空を溶かした色の酒。記憶が1つ消える', rarity: 5, price: 1200
  },
  kazimierz_champagne: {
    id: 'kazimierz_champagne', name: 'カジミエーシュ凱旋杯', emoji: '🏆', type: 'drink',
    damage: 2, description: '闘技場の優勝者に注がれる泡酒。勢いが止まらない', rarity: 3, price: 600
  },
  laterano_sacrament: {
    id: 'laterano_sacrament', name: 'ラテラーノ聖餐酒', emoji: '⛪', type: 'drink',
    damage: 2, description: '聖堂で振る舞われる神聖な葡萄酒。飲むと心が少し安らぐ', rarity: 3, price: 550
  },
  yen_ergot: {
    id: 'yen_ergot', name: '炎国・麦角酒', emoji: '🍄', type: 'drink',
    damage: 4, description: '禁制品。視界が歪み手札が1枚「発情」状態に汚染される', rarity: 5, price: 1300
  },

  // === アークナイツ特化フード（回復・防御） ===
  closure_pill: {
    id: 'closure_pill', name: 'クロージャの怪しい錠剤', emoji: '💊', type: 'food',
    heal: 2, description: '「副作用？ないない！…多分ね」デバフ1つ除去', rarity: 3, price: 600
  },
  penguin_pizza: {
    id: 'penguin_pizza', name: 'ペンギン急便のピザ', emoji: '🍕', type: 'food',
    heal: 2, description: 'エクシアが出前で持ってくる。チーズが異常に伸びる', rarity: 2, price: 300
  },
  silverash_tea: {
    id: 'silverash_tea', name: 'シルバーアッシュの高山茶・極', emoji: '🫖', type: 'food',
    heal: 3, description: 'カランド貿易の最高級品。一口で冷静さを取り戻す', rarity: 4, price: 900
  },
  gavial_herb: {
    id: 'gavial_herb', name: 'ガヴィルの薬草スープ', emoji: '🌿', type: 'food',
    heal: 2, description: '「サルカズ式だから苦いよ」継続ダメージを即座に止める', rarity: 3, price: 550
  },
  ceylon_cake: {
    id: 'ceylon_cake', name: 'セイロンの紅茶ケーキ', emoji: '🍰', type: 'food',
    heal: 1, description: 'マナウスの令嬢が焼いた上品な一品。じんわり効く', rarity: 2, price: 280
  },

  // === アークナイツ一気飲み（ハイリスク） ===
  reunion_toast: {
    id: 'reunion_toast', name: 'レユニオン式革命杯', emoji: '✊', type: 'chug',
    effect: 'chug', enemyDamage: 4, selfDamage: 2,
    description: '「同志よ、飲め！」タルラの檄に従い互いに限界まで煽る', rarity: 4, price: 1000
  },
  rhodes_roulette: {
    id: 'rhodes_roulette', name: 'ロドス深夜の闇鍋酒', emoji: '🎰', type: 'chug',
    effect: 'roulette',
    description: '50%→相手4dmg / 50%→自分3dmg。ドクターの悪ノリ企画', rarity: 3, price: 700
  },
  ursus_dare: {
    id: 'ursus_dare', name: 'ウルサス式度胸試し', emoji: '🐻', type: 'chug',
    effect: 'chug', enemyDamage: 2, selfDamage: 2,
    description: '「帝国では挨拶代わりだ」互いに飲み合い、場がヒートアップ', rarity: 3, price: 650
  },

  // === アークナイツ戦略系（妨害・情報） ===
  jessica_intel: {
    id: 'jessica_intel', name: 'ジェシカの内部情報', emoji: '🐱', type: 'strategy',
    effect: 'distract',
    description: '「あ、あの…これ見ちゃったんですけど…」相手の手札を全て確認 + 1T攻撃半減', rarity: 2, price: 400
  },
  swire_order: {
    id: 'swire_order', name: 'スワイヤーの命令', emoji: '📋', type: 'strategy',
    effect: 'rumor',
    description: '「あたしに逆らう気？」相手の最高dmgカードを破棄', rarity: 3, price: 700
  },
  projekt_red_swap: {
    id: 'projekt_red_swap', name: 'プロジェクト・レッドの奇襲', emoji: '🐺', type: 'strategy',
    effect: 'distract',
    description: '一瞬でグラスが入れ替わる。自分と相手の酔いLvを入れ替え', rarity: 4, price: 1100
  },
  texas_bluff: {
    id: 'texas_bluff', name: 'テキサスのポーカーフェイス', emoji: '🃏', type: 'strategy',
    effect: 'distract',
    description: '「…ハッタリだと思うか？」相手の次のカード効果を無効化', rarity: 3, price: 650
  },

  // === アークナイツ環境系（場の変化） ===
  rhodes_party: {
    id: 'rhodes_party', name: 'ロドス艦内パーティ', emoji: '🎉', type: 'environment',
    effect: 'karaoke', duration: 3,
    description: '3T: 双方drink dmg+1。周年記念の宴会', rarity: 3, price: 700
  },
  penguin_vip: {
    id: 'penguin_vip', name: 'ペンギン急便VIPルーム', emoji: '🚪', type: 'environment',
    effect: 'dimlight', duration: 3,
    description: '3T: harassment必要Lv-1 & 二人きり。「さ、二人きりだよ」', rarity: 4, price: 1000
  },
  babel_requiem: {
    id: 'babel_requiem', name: 'バベルの残響', emoji: '💮', type: 'environment',
    effect: 'karaoke', duration: 3,
    description: 'テレジアの記憶が蘇る。場の空気が重く、酒が深く染みる', rarity: 5, price: 1500
  },
  contingency_contract: {
    id: 'contingency_contract', name: '危機契約発令', emoji: '⚠️', type: 'environment',
    effect: 'lastorder',
    description: '「作戦時間短縮」残りラウンドが3減る。決着を急げ', rarity: 5, price: 1200
  },

  // === アークナイツ状態異常系 ===
  warfarin_bite: {
    id: 'warfarin_bite', name: 'ワルファリンの一噛み', emoji: '🧛', type: 'status',
    effect: 'tipsy',
    description: '「少しだけ…いただくわ」dot 1dmg x 3T + 自分heal: 2', rarity: 4, price: 900
  },
  eyja_eruption: {
    id: 'eyja_eruption', name: 'エイヤの噴火カクテル', emoji: '🌋', type: 'status',
    effect: 'tipsy',
    description: '火山のように熱い一杯。体温が上がって酔いが回りやすくなる', rarity: 3, price: 650
  },
  manticore_stealth: {
    id: 'manticore_stealth', name: 'マンティコアの隠密', emoji: '👻', type: 'status',
    effect: 'alone',
    description: '「…見えない、から」2T: 相手のharassmentを無効化', rarity: 4, price: 850
  },
  aak_injection: {
    id: 'aak_injection', name: 'アークの実験注射', emoji: '💉', type: 'status',
    effect: 'tipsy',
    description: '「大丈夫大丈夫、たぶん」自分2T drink dmg x1.5 + self 1dmg', rarity: 4, price: 900
  },

  // === アークナイツ セクハラカード（CG発動） ===
  hand_hold: {
    id: 'hand_hold', name: 'そっと手を握る', emoji: '🤝', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '「…冷たい手ですね、ドクター」カウンターの下で指を絡める', rarity: 3, price: 500
  },
  doctor_coat: {
    id: 'doctor_coat', name: '白衣を掛けてあげる', emoji: '🥼', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '「寒いでしょ」肩に白衣。ドクターの匂いがする', rarity: 3, price: 520
  },
  wall_pin: {
    id: 'wall_pin', name: '壁ドン', emoji: '🧱', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '「…逃がさない」廊下の壁際、腕で退路を塞ぐ', rarity: 4, price: 1500
  },
  piggyback: {
    id: 'piggyback', name: 'おんぶして帰る', emoji: '🌙', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 2,
    description: '「帰れないでしょ、ほら背中」体温と鼓動が伝わるCG', rarity: 5, price: 3000
  },
  oripathy_check: {
    id: 'oripathy_check', name: '鉱石病検診（意味深）', emoji: '🩺', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '「定期検査です…服、脱いでもらえますか」ドクター権限の乱用', rarity: 4, price: 1600
  },

  // === セクハラカード（特殊・CG発動） ===
  shoulder_lean: {
    id: 'shoulder_lean', name: '肩を寄せる', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '酔いLv.1以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  headpat: {
    id: 'headpat', name: '頭ポンポン', emoji: '🫳', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 1,
    description: '酔いLv.2以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  lap_pillow: {
    id: 'lap_pillow', name: '膝枕する', emoji: '💕', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 2,
    description: '酔いLv.3以上で発動。酔い+2 & CG再生', rarity: 5, price: 3000
  },
  kiss: {
    id: 'kiss', name: 'キス', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 3, instantWin: true,
    description: '酔いLv.3以上で発動。即酔い潰し(勝利) & CG再生', rarity: 6, price: 5000
  }
};

/**
 * カードの実ダメージを取得（カクテルのランダム対応）
 */
function getCardDamage(card) {
  if (card.damage === -1) {
    return Math.floor(Math.random() * 3) + 1; // 1~3
  }
  return card.damage;
}

/**
 * 初期デッキ
 */
const DEFAULT_DECK = [
  'beer', 'beer', 'beer', 'beer',
  'wine', 'wine',
  'nuts', 'nuts', 'nuts',
  'yakitori',
  'whiskey',
  'chug'
];
