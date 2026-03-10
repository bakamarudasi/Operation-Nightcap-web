import type { CardDef } from './types.ts';

export const CARD_DATA: Record<string, CardDef> = {
  // === ドリンクカード（攻撃） ===
  beer: {
    id: 'beer', name: '龍門ラガー', emoji: '🍺', type: 'drink',
    damage: 1, description: '龍門の屋台で必ず出てくる地ビール。とりあえずこれ', rarity: 1, price: 100
  },
  wine: {
    id: 'wine', name: 'ヴィクトリア産熟成赤', emoji: '🍷', type: 'drink',
    damage: 2, description: '王国の晩餐会御用達。品があって、それなりに効く', rarity: 2, price: 300
  },
  whiskey: {
    id: 'whiskey', name: 'ウルサス原酒ストレート', emoji: '🥃', type: 'drink',
    damage: 3, description: '帝国の極寒が生んだ重厚な一杯。一口で胃が焼ける', rarity: 3, price: 500
  },
  baijiu: {
    id: 'baijiu', name: '炎国・茅台酒', emoji: '🍶', type: 'drink',
    damage: 4, description: '歴史ある炎国の国酒。飲んだ者は皆、地に伏す', rarity: 4, price: 800
  },
  cocktail: {
    id: 'cocktail', name: 'ペンギン急便スペシャル', emoji: '🧊', type: 'drink',
    damage: -1, // ランダム(1~3)
    description: '「中身は企業秘密」。エクシア謹製、何が入ってるかは飲んでから分かる', rarity: 2, price: 400
  },

  // === つまみカード（防御・回復） ===
  nuts: {
    id: 'nuts', name: '行軍糧食', emoji: '🥜', type: 'food',
    heal: 1, description: 'ロドス配給の携帯食。味気ないが確実に体を支える', rarity: 1, price: 100
  },
  yakitori: {
    id: 'yakitori', name: '龍門屋台の串焼き', emoji: '🍖', type: 'food',
    heal: 2, description: '龍門の夜市名物。煙と喧騒の中で食う一本がたまらない', rarity: 2, price: 300
  },
  ramen: {
    id: 'ramen', name: '龍門式老火麺', emoji: '🍜', type: 'food',
    heal: 3, description: '〆はこれに限る。長時間煮込んだスープが酔いを芯から癒す', rarity: 3, price: 600
  },
  ukon: {
    id: 'ukon', name: 'ケルシー処方薬', emoji: '💊', type: 'food',
    heal: 5, description: 'クロージャが裏ルートで横流しした禁断の回復薬。「お前には過ぎた代物だ」', rarity: 5, price: 1500
  },

  // === 戦略・妨害カード ===
  rumor: {
    id: 'rumor', name: '龍門の噂話', emoji: '🗣️', type: 'strategy',
    effect: 'rumor',
    description: '「ねえ聞いた？」相手の次に出すカードをランダムに差し替える。ペンギン急便の情報網を使った情報戦', rarity: 3, price: 600
  },
  excuse: {
    id: 'excuse', name: '「酔ってるから」', emoji: '🙈', type: 'strategy',
    effect: 'excuse',
    description: 'ハラスメントカードの発動必要酔いLvを1下げる。「これは任務の一環です」', rarity: 4, price: 900
  },
  distract: {
    id: 'distract', name: '話題転換', emoji: '👁️', type: 'strategy',
    effect: 'distract',
    description: '相手の手札を全て確認する。「そういえば、ウルサスのこと聞きましたよ」', rarity: 2, price: 500
  },

  // === 環境変化カード ===
  karaoke: {
    id: 'karaoke', name: 'カラオケ2次会', emoji: '🎤', type: 'environment',
    effect: 'karaoke', duration: 3,
    description: '3ターン、全ドリンクのダメージ+1。「まだ終わりませんよ、ドクター」', rarity: 3, price: 700
  },
  lastorder: {
    id: 'lastorder', name: 'ラストオーダー', emoji: '🔔', type: 'environment',
    effect: 'lastorder',
    description: '次のターンのみ手札を全て使用可能。「閉店前の最後のチャンスです」', rarity: 4, price: 1000
  },
  dimlight: {
    id: 'dimlight', name: '照明を落とす', emoji: '🕯️', type: 'environment',
    effect: 'dimlight', duration: 2,
    description: '2ターン、全ハラスメントカードの必要酔いLvを1下げる。「…暗くしたんですか」', rarity: 3, price: 800
  },

  // === 状態異常カード ===
  tipsy: {
    id: 'tipsy', name: 'ほろ酔い状態', emoji: '😳', type: 'status',
    effect: 'tipsy',
    description: '相手をほろ酔い状態にする。ほろ酔い時は受けるドリンクダメージが1.5倍になる', rarity: 3, price: 750
  },
  blush: {
    id: 'blush', name: '顔が赤い', emoji: '😶‍🌫️', type: 'status',
    effect: 'blush',
    description: '相手を動揺状態にする。動揺中はハラスメントカードのdrunkDamageが+1される', rarity: 4, price: 1100
  },
  alone: {
    id: 'alone', name: '二人きり', emoji: '🌙', type: 'status',
    effect: 'alone',
    description: '2ターン、場の状態を「二人きり」にする。この間ハラスメントカードのダメージが2倍', rarity: 5, price: 2000
  },

  // === 一気飲みカード（ハイリスク） ===
  chug: {
    id: 'chug', name: 'レユニオン式気合注入', emoji: '🍻', type: 'chug',
    effect: 'chug', enemyDamage: 3, selfDamage: 1,
    description: '「ためらうな、飲め！」相手に酔い3ダメージ。自分も巻き込まれて酔い1ダメージ', rarity: 3, price: 800
  },
  toast: {
    id: 'toast', name: '強制乾杯令', emoji: '🥂', type: 'chug',
    effect: 'toast', enemyDamage: 2, selfDamage: 1,
    description: '断れない空気を作り出す上級テクニック。相手に酔い2+次ターン手札破棄。自分も酔い1',
    rarity: 3, price: 700
  },
  spill: {
    id: 'spill', name: 'わざとこぼし', emoji: '🫗', type: 'chug',
    effect: 'spill',
    description: '「あっ、ごめんなさい」相手のカード効果を無効化。次ターン自分の手札が3枚に減る',
    rarity: 2, price: 500
  },

  // === セクハラカード（特殊・CG発動） ===
  shoulder_lean: {
    id: 'shoulder_lean', name: '耳元でささやく', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '肩を寄せて耳元に唇を近づける。「…少し、近すぎませんか」酔いLv.1以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  headpat: {
    id: 'headpat', name: 'うなじを撫でる', emoji: '🫳', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 1,
    description: '髪をかき上げてうなじに指を這わせる。「…っ、何を」酔いLv.2以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  breast_touch: {
    id: 'breast_touch', name: '胸に触れる', emoji: '🫦', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 3,
    description: '「酔ってるから」を口実にそっと手を伸ばす。「…これは、任務外です」酔いLv.2以上で発動。酔い+3 & CG再生', rarity: 5, price: 4000
  },
  hip_touch: {
    id: 'hip_touch', name: 'お尻をなでる', emoji: '🍑', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '隣に座ったまま大胆に手を滑らせる。「っ…ドクター、あなたは」酔いLv.2以上で発動。酔い+2 & CG再生', rarity: 5, price: 3500
  },
  ear_bite: {
    id: 'ear_bite', name: '耳を甘噛み', emoji: '👅', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 3,
    description: '耳たぶをそっと唇で挟む。「…もう、やめて、ください」酔いLv.3以上で発動。酔い+3 & CG再生', rarity: 5, price: 4500
  },
  kiss: {
    id: 'kiss', name: 'ディープキス', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 3, instantWin: true,
    description: '腰を引き寄せて深く口づけ。「…もう、いいです。いいですから…」酔いLv.3以上で発動。即KO & CG再生', rarity: 6, price: 5000
  },

  // === ガチャ追加ドリンク ===
  shochu: {
    id: 'shochu', name: '東国芋焼酎', emoji: '🍶', type: 'drink',
    damage: 1, description: '東の島で蒸留された素朴な酒。湯割りが正解', rarity: 1, price: 100
  },
  soju: {
    id: 'soju', name: '高麗焼酎', emoji: '🫗', type: 'drink',
    damage: 1, description: '甘くて飲みやすいが油断すると足に来る', rarity: 1, price: 100
  },
  ale: {
    id: 'ale', name: 'カジミエーシュ麦酒', emoji: '🍺', type: 'drink',
    damage: 2, description: '騎士たちの祝杯用。泡がきめ細かく喉越し抜群', rarity: 2, price: 280
  },
  liter_beer: {
    id: 'liter_beer', name: 'ジョッキ一気', emoji: '🍻', type: 'drink',
    damage: 2, description: '巨大ジョッキで一気飲み。周囲が盛り上がる', rarity: 2, price: 350
  },
  sparkling: {
    id: 'sparkling', name: 'コロンビア産泡酒', emoji: '🥂', type: 'drink',
    damage: 2, description: '新興都市の洗練。細かい泡が喉を撫でる', rarity: 2, price: 320
  },
  rice_wine: {
    id: 'rice_wine', name: '炎国紹興酒', emoji: '🫘', type: 'drink',
    damage: 2, description: '温めると芳醇な香りが広がる。甕出しが最高', rarity: 2, price: 290
  },
  mead: {
    id: 'mead', name: 'サーミ蜂蜜酒', emoji: '🍯', type: 'drink',
    damage: 2, description: '極北の蜂蜜で醸した甘い酒。凍えた体を優しく温める', rarity: 2, price: 310
  },
  herb_liqueur: {
    id: 'herb_liqueur', name: 'イベリア薬草酒', emoji: '🌿', type: 'drink',
    damage: 3, description: '修道院秘伝のハーブリキュール。薬か酒か分からない味', rarity: 3, price: 550
  },
  absinthe: {
    id: 'absinthe', name: 'リターニアの緑妖精', emoji: '🧚', type: 'drink',
    damage: 3, description: 'アーツが見える…気がする禁断の蒸留酒。角砂糖を添えて', rarity: 3, price: 600
  },
  stout: {
    id: 'stout', name: 'ヴィクトリア黒ビール', emoji: '🍫', type: 'drink',
    damage: 3, description: 'コーヒーのような苦みと甘み。一杯で満足感がすごい', rarity: 3, price: 480
  },
  gin: {
    id: 'gin', name: 'コロンビア・ドライジン', emoji: '🫧', type: 'drink',
    damage: 3, description: 'ボタニカルが香る都会派の一杯。トニックで割って', rarity: 3, price: 520
  },
  sake: {
    id: 'sake', name: '東国・純米大吟醸', emoji: '🍶', type: 'drink',
    damage: 3, description: '極上の米から生まれた透明な芸術品。冷やで味わうべし', rarity: 3, price: 650
  },
  mystery_flask: {
    id: 'mystery_flask', name: '謎のフラスコ', emoji: '⚗️', type: 'drink',
    damage: -1, description: 'ロドス研究室から流出した謎液体。飲んだ者は語らない', rarity: 3, price: 500
  },
  double_shot: {
    id: 'double_shot', name: 'ダブルショット', emoji: '🥃', type: 'drink',
    damage: 4, description: 'ウィスキーをダブルで。「…付き合ってくれ、今夜は」', rarity: 4, price: 900
  },
  brandy: {
    id: 'brandy', name: 'ガリア産ブランデー', emoji: '🫗', type: 'drink',
    damage: 4, description: '琥珀色の液体が揺れる。大人の夜にふさわしい一杯', rarity: 4, price: 1000
  },

  // === ガチャ追加フード ===
  black_bread: {
    id: 'black_bread', name: 'ウルサス黒パン', emoji: '🍞', type: 'food',
    heal: 1, description: '帝国兵の主食。硬いが噛むほど味が出る', rarity: 1, price: 80
  },
  candy: {
    id: 'candy', name: 'ペンギン急便キャンディ', emoji: '🍬', type: 'food',
    heal: 1, description: 'エクシアが配り歩く謎味キャンディ。たまにアタリ', rarity: 1, price: 60
  },
  opera_cake: {
    id: 'opera_cake', name: 'リターニア歌劇菓子', emoji: '🍰', type: 'food',
    heal: 1, description: '歌劇場のロビーで売られる小さな焼き菓子。上品な甘さ', rarity: 1, price: 120
  },
  dimsum: {
    id: 'dimsum', name: '龍門式飲茶', emoji: '🥟', type: 'food',
    heal: 2, description: '小さな蒸籠に詰まった龍門の味。お茶と一緒に', rarity: 2, price: 280
  },
  highland_tea: {
    id: 'highland_tea', name: 'シルバーアッシュの茶', emoji: '🍵', type: 'food',
    heal: 2, description: 'カランド貿易が扱う高山茶。一口で目が覚める', rarity: 2, price: 350
  },
  daily_meal: {
    id: 'daily_meal', name: 'ロドス食堂の日替り', emoji: '🍱', type: 'food',
    heal: 2, description: 'ガムラの渾身作。毎日違うメニューが出る。たまに事故る', rarity: 2, price: 250
  },
  skewer: {
    id: 'skewer', name: '羊肉串', emoji: '🍢', type: 'food',
    heal: 2, description: 'クミンと唐辛子が効いた炎国式串焼き。ビールが進む', rarity: 2, price: 270
  },
  grilled_fish: {
    id: 'grilled_fish', name: '龍門烤魚', emoji: '🐟', type: 'food',
    heal: 2, description: '丸ごと一匹を炭火でじっくり。ピリ辛ダレで食す', rarity: 2, price: 300
  },
  jerky: {
    id: 'jerky', name: 'クルビア式ジャーキー', emoji: '🥩', type: 'food',
    heal: 2, description: '荒野を駆けるレンジャー御用達。塩気が酒を呼ぶ', rarity: 2, price: 230
  },
  dango: {
    id: 'dango', name: '東国式団子', emoji: '🍡', type: 'food',
    heal: 2, description: 'みたらし風のタレが甘辛い。ミヅキのお気に入り', rarity: 2, price: 240
  },
  ration_plus: {
    id: 'ration_plus', name: '強化レーション', emoji: '💪', type: 'food',
    heal: 3, description: '通常の3倍のカロリー。味は保証しない', rarity: 3, price: 450
  },
  mushroom_soup: {
    id: 'mushroom_soup', name: 'サルカズ毒キノコ鍋', emoji: '🍄', type: 'food',
    heal: 3, description: 'ちゃんと処理すれば美味い…らしい。自己責任で', rarity: 3, price: 580
  },
  bibimbap: {
    id: 'bibimbap', name: '高麗式石焼ビビンバ', emoji: '🍳', type: 'food',
    heal: 3, description: '熱々の石鍋で混ぜる。おこげが最高に美味い', rarity: 3, price: 550
  },
  hangover_set: {
    id: 'hangover_set', name: '二日酔いセット', emoji: '🧊', type: 'food',
    heal: 3, description: '冷たいスープと胃薬のセット。翌朝の救世主', rarity: 3, price: 500
  },
  hotpot: {
    id: 'hotpot', name: '炎国激辛火鍋', emoji: '🫕', type: 'food',
    heal: 4, description: '汗だくで鍋を囲む。距離が自然と近くなる', rarity: 4, price: 850
  },

  // === ガチャ追加アクション ===
  fix_collar: {
    id: 'fix_collar', name: '襟を直してあげる', emoji: '👔', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '「曲がってますよ」指先が首筋に触れる。意図的に。酔いLv.1以上で発動', rarity: 3, price: 500
  },
  check_pulse: {
    id: 'check_pulse', name: '脈を測る', emoji: '💓', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '「顔が赤いですね…脈を」手首をそっと掴む。ドクターらしい口実。酔いLv.1以上で発動', rarity: 3, price: 520
  },

  // === 追加セクハラカード ===
  lap_pillow: {
    id: 'lap_pillow', name: '膝枕', emoji: '🛌', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 2,
    description: '相手の頭をそっと膝に導く。「…ここで寝ちゃっていいよ」酔いLv.3以上で発動。酔い+2 & CG再生', rarity: 5, price: 3000
  },

  // === 逆セクハラカード（相手→プレイヤーへの理性攻撃） ===
  foot_tease: {
    id: 'foot_tease', name: 'テーブルの下の足首', emoji: '🦶', type: 'harassment',
    requiredDrunkLevel: 2, sanityDamage: 3,
    applyBuffs: [{ id: 'atk_down', duration: 1, value: 0.5 }],
    description: '素足がテーブルの下でドクターの股間をゆっくり擦り上げる。酔いLv.2以上。理性+3 & 攻撃半減1T & CG再生',
    rarity: 5, price: 3000
  },
  dirty_talk: {
    id: 'dirty_talk', name: '淫らな耳元囁き', emoji: '👄', type: 'harassment',
    requiredDrunkLevel: 2, sanityDamage: 2,
    corruptHand: 2,
    description: '「今夜は最後まで帰さないから…」手札2枚を発情状態に。酔いLv.2以上。理性+2 & 手札汚染 & CG再生',
    rarity: 5, price: 3500
  },
};

export function getCardDamage(card: CardDef): number {
  if (card.damage === -1) {
    return Math.floor(Math.random() * 3) + 1;
  }
  return card.damage ?? 0;
}

export const DEFAULT_DECK: string[] = [
  'beer', 'beer', 'beer',
  'wine', 'wine', 'wine',
  'nuts', 'nuts',
  'yakitori', 'yakitori',
  'whiskey',
  'chug'
];
