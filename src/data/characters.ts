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
      harassmentSuccess: ['なっ……！？ ……ばか'],
      harassmentFail: ['ん？ 何やってんの？', '……シラフでそれやる度胸は認めるけどね'],
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
          { speaker: 'ドクター', text: '（そっと肩を寄せる）' },
          { speaker: 'ブレイズ', text: '……っ、なに、急に' },
          { speaker: 'ブレイズ', text: '……別に、嫌じゃないけど。……今日だけだからね？' }
        ]
      },
      {
        id: 'blaze_headpat',
        triggerCard: 'headpat',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（頭をぽんぽんする）' },
          { speaker: 'ブレイズ', text: 'ちょっ……子ども扱いしないでよ……' },
          { speaker: 'ブレイズ', text: '……もうちょっとだけ。……上手いんだから、ずるいよ' }
        ]
      },
      {
        id: 'blaze_gaze',
        triggerCard: 'gaze',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（じっと見つめる）' },
          { speaker: 'ブレイズ', text: 'ちょ……そんな見ないでよ……' },
          { speaker: 'ブレイズ', text: '…………聞こえてるでしょ、心臓の音。……ドクターのせいだからね' }
        ]
      },
      {
        id: 'blaze_lap',
        triggerCard: 'lap_pillow',
        requiredDrunkLevel: 3,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（膝を差し出す）' },
          { speaker: 'ブレイズ', text: 'え……膝枕？ 私に？ ……ふふ、ドクターって大胆だよね' },
          { speaker: 'ブレイズ', text: '……ちょっとだけだよ。……ん……あったかい……zzZ' }
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
          { speaker: 'ブレイズ', text: '……え、ちょっと……マジで言ってる……？' },
          { speaker: 'ブレイズ', text: '…………ばか。……逃がさないからね' }
        ]
      }
    ]
  }
};
