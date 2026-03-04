import type { CharacterDef } from './types.ts';

export const CHARACTER_DATA: Record<string, CharacterDef> = {
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
          'さぁ飲もっか！ついてきなよドクター！',
          'まだまだ序の口だよ、本気出してないから',
          'ドクター、お酒強い方？……ふーん、じゃあ勝負しよっか'
        ]
      },
      {
        level: 1, name: 'ほろ酔い', threshold: 2,
        lines: [
          'あはは！いい気分になってきたかも',
          'ねぇドクター、もう一杯いこうよ。……私が注いであげよっか？',
          'この酒おいしいね！クロージャいいもん仕入れてるじゃん'
        ]
      },
      {
        level: 2, name: '酔い', threshold: 4,
        lines: [
          'ん……なんか暑くない？ ちょっとだけ、前はだけていい……？',
          'ドクター……なんか今日、顔近くない？ ……別にいいけどさ',
          'ふぅ……ちょっと効いてきたかも。……なんてね、まだまだいけるよ'
        ]
      },
      {
        level: 3, name: 'べろべろ', threshold: 7,
        lines: [
          'ドクターぁ……もっとこっち来なよぉ。寒いんだから……',
          '私ね……別にドクターのこと……ぅん……嫌いじゃ、ないよ……',
          'んー……ドクターってさ、いい匂いするよね……もうちょっとだけ、嗅いでていい？'
        ]
      },
      {
        level: 4, name: '潰れ', threshold: 10,
        lines: [
          '………zzZ',
          '……ドクター……あったかい……このまま……zzZ'
        ]
      }
    ],
    battleLines: {
      playDrink: ['おっ、やるじゃん！', 'いい勝負だね！'],
      playFood: ['つまみ？ ……逃がさないよ？', 'おいしそうなもん食べてるね'],
      playChug: ['一気いくよ！！ついてきて！', 'あはは！飲め飲めー！'],
      takeDamage: ['くっ……効くね……', 'やるじゃん……！'],
      dealDamage: ['ほら、もっと飲みなよ！', 'まだまだぁ！'],
      harassmentSuccess: ['んっ……！？ やだ……こんなとこで……ばか……っ', '……っ、そういうの反則だって……体、ビクってなったじゃん……'],
      harassmentFail: ['は？ シラフで何してんの変態', '……酔ってもないのにそれやる？ 度胸だけは一人前だね'],
      winLine: 'あっはは！私の勝ちっ！ 弱いなぁドクター。……ま、罰ゲームは後で考えてあげるよ',
      loseLine: '………zzZ……ドクター……ばか……もう飲ませないでよ……'
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
          { speaker: 'ドクター', text: '（そっと肩を寄せ、耳元に顔を近づける）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！ ちょ、近い近い……息、当たってるんだけど……' },
          { speaker: 'ブレイズ', text: '……っ、なに、そんな近くで匂い嗅いでんの……変態じゃん……' },
          { speaker: 'ブレイズ', text: '………べ、別に嫌とは言ってないし。……もうちょっとだけ、くっついてていいよ' }
        ]
      },
      {
        id: 'blaze_headpat',
        triggerCard: 'headpat',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（髪をかき上げ、うなじに指先をそっと這わせる）' },
          { speaker: 'ブレイズ', text: 'ひっ……！ そこ、だめ……うなじ弱いの知ってるでしょ……っ' },
          { speaker: 'ブレイズ', text: '……ん、指……冷たい……ぞくぞくする……やめてよ……' },
          { speaker: 'ブレイズ', text: '……やめてって言ってるのに……もっと奥まで触って……ばか' }
        ]
      },
      {
        id: 'blaze_gaze',
        triggerCard: 'gaze',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（顎を持ち上げ、濡れた唇をじっと見つめる）' },
          { speaker: 'ブレイズ', text: '……っ！ くち、見んな……恥ずかしいだろ……' },
          { speaker: 'ブレイズ', text: '……唇、乾いちゃうじゃん……そんなに見られたら……っ' },
          { speaker: 'ブレイズ', text: '……ねぇ。見てるだけじゃなくて……してよ、早く' }
        ]
      },
      {
        id: 'blaze_breast',
        triggerCard: 'breast_touch',
        requiredDrunkLevel: 2,
        cgColor: '#ff6b8a',
        dialogue: [
          { speaker: 'ドクター', text: '（酔ったふりをして、ブレイズの胸にそっと手を当てる）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！！ ちょ、ど、どこ触って……っ！' },
          { speaker: 'ブレイズ', text: '……っ、ばか……酔ってるからって許されると思ってんの……？' },
          { speaker: 'ブレイズ', text: '……手、どけないの……？ ……どけなくて、いいけど……今だけだからね……っ' },
          { speaker: 'ブレイズ', text: '……ん……ドクターの手、あったかい……心臓、ばくばくしてるの……わかるでしょ……' }
        ]
      },
      {
        id: 'blaze_hip',
        triggerCard: 'hip_touch',
        requiredDrunkLevel: 2,
        cgColor: '#ff7b6b',
        dialogue: [
          { speaker: 'ドクター', text: '（隣に座ったまま、ブレイズのお尻にそっと手を滑らせる）' },
          { speaker: 'ブレイズ', text: 'んっ……！ ちょ、待っ……そこ、お尻……っ！！' },
          { speaker: 'ブレイズ', text: '……信じらんない……こんなとこで何してんのドクター……変態……っ' },
          { speaker: 'ブレイズ', text: '……揉まないでよ……嘘、もうちょっとだけ……ぁ……だめ、声出ちゃう……' }
        ]
      },
      {
        id: 'blaze_ear',
        triggerCard: 'ear_bite',
        requiredDrunkLevel: 3,
        cgColor: '#ff5577',
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの耳たぶを唇でそっと挟む）' },
          { speaker: 'ブレイズ', text: 'ひぁっ……！！ み、耳はだめっ……感じる……っ！' },
          { speaker: 'ブレイズ', text: '……んっ、舌……やだ、ぞくぞくする……もう、だめ……' },
          { speaker: 'ブレイズ', text: '……ドクター、最低……こんなの……もっと、して……' },
          { speaker: 'ブレイズ', text: '……もう帰さないから……今夜は覚悟してよね……' }
        ]
      },
      {
        id: 'blaze_lap',
        triggerCard: 'lap_pillow',
        requiredDrunkLevel: 3,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの頭をそっと膝に導き、髪を指に絡める）' },
          { speaker: 'ブレイズ', text: 'え、ちょ……膝枕とか……んっ、髪、触んないでよ……くすぐったい……' },
          { speaker: 'ブレイズ', text: 'ドクターの太もも……あったかい……すごい、心臓の音聞こえる……' },
          { speaker: 'ブレイズ', text: '……ねぇ、このまま寝ちゃったら……何する気？ ……してもいいよ、今なら……' },
          { speaker: 'ブレイズ', text: '……ん……もう動けない……ドクターの匂い……好き……zzZ' }
        ]
      },
      {
        id: 'blaze_kiss',
        triggerCard: 'kiss',
        requiredDrunkLevel: 3,
        cgColor: '#ff4466',
        instantWin: true,
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの腰を引き寄せ、唇に指を添える）' },
          { speaker: 'ブレイズ', text: '……え、うそ……マジで……？ こんな近くで見つめないでよ……' },
          { speaker: 'ブレイズ', text: '……心臓、止まりそう……ドクターの息、甘い……' },
          { speaker: 'ブレイズ', text: '………ん……っ' },
          { speaker: 'ブレイズ', text: '……ばか。もう遅いよ。……朝まで、逃がさないから' }
        ]
      }
    ]
  }
};
