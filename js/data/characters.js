/**
 * キャラクターデータ
 */
const CHARACTER_DATA = {
  blaze: {
    id: 'blaze',
    name: 'ブレイズ',
    nameEn: 'BLAZE',
    subtitle: '燃え盛る太陽',
    theme: {
      color: '#e85d3a',
      colorDark: '#b8432a',
      colorGlow: 'rgba(232, 93, 58, 0.4)',
      icon: '🔥'
    },
    drunkType: 'aggressive',
    drunkMax: 10,
    drunkLevels: [
      {
        level: 0, name: 'シラフ', threshold: 0,
        lines: [
          'さぁ飲むぞ！ついてこいよ！',
          'まだまだ序の口だぜ',
          'ドクター、あんた酒は強い方か？'
        ]
      },
      {
        level: 1, name: 'ほろ酔い', threshold: 2,
        lines: [
          'ハハッ！いい気分になってきた！',
          'なぁドクター、もう一杯いこうぜ',
          'この酒うめぇな！クロージャいいもん仕入れてんじゃん'
        ]
      },
      {
        level: 2, name: '酔い', threshold: 4,
        lines: [
          'おい…なんか暑くないか…？',
          'ドクター…顔ちかくねぇ？',
          'ふぅ…ちょっと効いてきたかも…なんてな！'
        ]
      },
      {
        level: 3, name: 'べろべろ', threshold: 7,
        lines: [
          'ドクターぁ…もっと近くに来いよぉ…',
          'あたし…別にドクターのこと…ぅう…',
          'んー…ドクターっていい匂いするよなぁ…'
        ]
      },
      {
        level: 4, name: '潰れ', threshold: 10,
        lines: [
          '………zzZ',
          '…ドクター…あったかい…zzZ'
        ]
      }
    ],
    battleLines: {
      playDrink: ['おっ、やるじゃん！', 'いい勝負だな！'],
      playFood: ['つまみか…ちっ、逃げるなよ', 'うまそうなもん食ってんな'],
      playChug: ['一気いくぜぇ！！', 'はっはっは！飲めぇ！'],
      takeDamage: ['くっ…効くな…', 'やるじゃねぇか…！'],
      dealDamage: ['ほらもっと飲めよ！', 'まだまだぁ！'],
      harassmentSuccess: ['なっ…！？', '……っ'],
      harassmentFail: ['は？何やってんだ？', 'おいおい…シラフでそれかよ'],
      winLine: 'はーっはっは！あたしの勝ちだ！弱いなドクター！',
      loseLine: '………zzZ……ドクター……ばか……'
    },
    deck_ai: {
      personality: 'aggressive',
      defaultDeck: [
        'beer', 'beer', 'beer',
        'wine', 'wine',
        'whiskey', 'whiskey',
        'baijiu',
        'nuts', 'nuts',
        'yakitori',
        'chug'
      ]
    },
    cgEvents: [
      {
        id: 'blaze_shoulder',
        triggerCard: 'shoulder_lean',
        requiredDrunkLevel: 1,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（そっと肩を寄せる）' },
          { speaker: 'ブレイズ', text: '……っ、なんだよ急に' },
          { speaker: 'ブレイズ', text: '……べつに、嫌じゃねーけど。今日だけだからな' }
        ]
      },
      {
        id: 'blaze_headpat',
        triggerCard: 'headpat',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（頭をぽんぽんする）' },
          { speaker: 'ブレイズ', text: 'なっ……子ども扱いすんなよ…' },
          { speaker: 'ブレイズ', text: '……もうちょっとだけ、いいけど' }
        ]
      },
      {
        id: 'blaze_lap',
        triggerCard: 'lap_pillow',
        requiredDrunkLevel: 3,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（膝を差し出す）' },
          { speaker: 'ブレイズ', text: 'はぁ？膝枕？あたしに？' },
          { speaker: 'ブレイズ', text: '……ちょっとだけだからな…zzZ…' }
        ]
      },
      {
        id: 'blaze_kiss',
        triggerCard: 'kiss',
        requiredDrunkLevel: 3,
        cgColor: '#ff4466',
        instantWin: true,
        dialogue: [
          { speaker: 'ドクター', text: '（顔を近づける）' },
          { speaker: 'ブレイズ', text: 'おい……マジかよ……' },
          { speaker: 'ブレイズ', text: '…………ばか' }
        ]
      }
    ]
  }
};
