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
      icon: '🔥',
      portraitImg: '/characters/blaze/portrait-drunk-0.webp',
      portraitDrunkImgs: {
        0: '/characters/blaze/portrait-drunk-0.webp',
        1: '/characters/blaze/portrait-drunk-1.webp',
        2: '/characters/blaze/portrait-drunk-2.webp',
        3: '/characters/blaze/portrait-drunk-3.webp',
        4: '/characters/blaze/portrait-drunk-4.webp',
      },
    },
    drunkType: 'aggressive',
    drunkMax: 10,
    costumeStates: [
      {
        level: 0, label: '通常', emoji: '👔',
        description: 'ロドスの制服をきっちり着ている',
        dishevelAmount: 0,
      },
      {
        level: 1, label: '少し緩む', emoji: '👕',
        description: '首元のボタンを外し、肩のラインが少し崩れている',
        dishevelAmount: 0.2,
      },
      {
        level: 2, label: '前はだけ', emoji: '💫',
        description: '「暑い」と言いながら前をはだけ、鎖骨と谷間がちらりと見える',
        dishevelAmount: 0.5,
      },
      {
        level: 3, label: '大胆に着崩れ', emoji: '🔥',
        description: '肩から服がずり落ち、下着の肩紐が見えている。太ももも露わに',
        dishevelAmount: 0.8,
      },
      {
        level: 4, label: 'ほぼ脱げ', emoji: '💋',
        description: '服が完全にはだけて下着姿同然。赤い頬で寝落ちしている',
        dishevelAmount: 1.0,
      },
    ],
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
        id: 'shoulder_lean_cg',
        triggerCard: 'shoulder_lean',
        requiredDrunkLevel: 1,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（そっと肩を寄せ、耳元に顔を近づける）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！ ちょ、近い近い……息、当たってるんだけど……' },
          { speaker: 'ドクター', text: '（……あったかい。大型の猫に顔を埋めているような、安心感と強い熱。 ロドスの制服越しでも伝わってくる柔らかさに、どうしようもなく惹きつけられる）' },
          { speaker: 'ブレイズ', text: '……っ、なに、そんな近くで匂い嗅いでんの……変態じゃん……' },
          { speaker: 'ブレイズ', text: '変態でいいよ。ブレイズの匂い、落ち着くんだ……もう少しこのままでいさせて' },
          { speaker: 'ドクター', text: '（だけど、さっきから彼女の体がずっと強張っている。さすがにやりすぎたか……？）' },
          { speaker: 'ドクター', text: '……ごめん。やっぱり嫌だったよな。離れるよ' },
          { speaker: 'ブレイズ', text: '………べ、別に嫌とは言ってないし。……もうちょっとだけ、くっついてていいよ' },
        ],
        frames: [
          {
            src: '/characters/blaze/cg/shoulder_lean_1.webp',
            label: '耳元に顔を近づけた感じ',
            dialogueStart: 0,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/shoulder_lean_2.webp',
            label: '１人称視点',
            dialogueStart: 1,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/shoulder_lean_3.webp',
            label: '照れる感じ',
            dialogueStart: 4,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/shoulder_lean_4.webp',
            label: 'いい感じ',
            dialogueStart: 6,
            transition: 'fade',
          },
        ],
      },

      {
        id: 'headpat_cg',
        triggerCard: 'headpat',
        requiredDrunkLevel: 2,
        cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（髪をかき上げ、うなじに指先をそっと這わせる）' },
          { speaker: 'ドクター', text: '（アルコールが回って、普段の隙のない姿が嘘のように無防備だ。無防備に晒されたうなじがやけに色っぽく見えて……つい手を伸ばしていた）' },
          { speaker: 'ブレイズ', text: 'ひっ……！ そこ、だめ……うなじ弱いの知ってるでしょ……っ' },
          { speaker: 'ドクター', text: '（ビクッと肩を震わせる反応がたまらなく可愛い。もっと乱れた顔が見たくて、わざと冷たくした指先をゆっくりと這わせる）' },
          { speaker: 'ブレイズ', text: '……ん、指……冷たい……ぞくぞくする……やめてよ……' },
          { speaker: 'ブレイズ', text: '……やめてって言ってるのに……もっと奥まで触って……ばか' },
          { speaker: 'ドクター', text: '（口では抵抗しながらも、体は熱を帯びて俺の手にすり寄ってきている。完全に理性が溶けかかっているな……）' },
        ],
        frames: [
          {
            src: '/characters/blaze/cg/headpat_1.webp',
            label: '見る',
            dialogueStart: 0,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/headpat_2.webp',
            label: 'なでる',
            dialogueStart: 1,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/headpat_3.webp',
            label: 'にやついてる',
            dialogueStart: 4,
            transition: 'fade',
          },
        ],
      },
      {
        id: 'breast_touch_cg',
        triggerCard: 'breast_touch',
        requiredDrunkLevel: 2,
        cgColor: '#ff6b8a',
        dialogue: [
          { speaker: 'ドクター', text: '（酔ったふりをして、ブレイズの胸にそっと手を当てる）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！！ ちょ、ど、どこ触って……っ！' },
          { speaker: 'ドクター', text: '（驚いて跳ねるような反応とは裏腹に、手のひらには彼女の豊かな柔らかさと、ドクン、ドクンという早い鼓動が伝わってくる）' },
          { speaker: 'ブレイズ', text: '……っ、ばか……酔ってるからって許されると思ってんの……？' },
          { speaker: 'ドクター', text: '（睨みつけてくる瞳は潤んでいて、本気で拒絶する気がないのは明白だった。もう少しだけ、このまま……）' },
          { speaker: 'ブレイズ', text: '……手、どけないの……？ ……どけなくて、いいけど……今だけだからね……っ' },
          { speaker: 'ドクター', text: '――もう一度。さっきより、少しだけ強く。   タンクトップ越しに伝わる熱と、指が沈んでいく感触。離すタイミングを、とっくに見失っていた。' },
          { speaker: 'ブレイズ', text: '……ん……ドクターの手、あったかい……心臓、ばくばくしてるの……わかるでしょ……' },
        ],
        frames: [
          {
            src: '/characters/blaze/cg/breast_touch_1.webp',
            label: '手が伸びる',
            dialogueStart: 0,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/breast_touch_2.webp',
            label: '胸に触れる',
            dialogueStart: 4,
            transition: 'zoom',
          },
          {
            src: '/characters/blaze/cg/breast_touch_3.webp',
            label: '感じてる表情',
            dialogueStart: 6,
            transition: 'fade',
          },
        ],
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
        ],
        frames: [
          {
            src: '/characters/blaze/cg/hip_touch.webp',
            label: 'お尻をなでる',
            dialogueStart: 0,
            transition: 'fade',
          },
        ],
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
        ],
        frames: [
          {
            src: '/characters/blaze/cg/ear_bite_1.webp',
            label: '耳に顔を近づける',
            dialogueStart: 0,
            transition: 'slide-left',
          },
          {
            src: '/characters/blaze/cg/ear_bite_2.webp',
            label: '耳たぶを噛む',
            dialogueStart: 1,
            transition: 'zoom',
          },
          {
            src: '/characters/blaze/cg/ear_bite_3.webp',
            label: '蕩けた表情',
            dialogueStart: 3,
            transition: 'fade',
          },
        ],
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
        ],
        frames: [
          {
            src: '/characters/blaze/cg/lap_pillow.webp',
            label: '太ももに誘う',
            dialogueStart: 0,
            transition: 'fade',
          },
        ],
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
        ],
        frames: [
          {
            src: '/characters/blaze/cg/kiss_1.webp',
            label: '腰を引き寄せる',
            dialogueStart: 0,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/kiss_2.webp',
            label: '唇が近づく',
            dialogueStart: 2,
            transition: 'zoom',
          },
          {
            src: '/characters/blaze/cg/kiss_3.webp',
            label: 'キス',
            dialogueStart: 3,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/kiss_4.webp',
            label: '余韻',
            dialogueStart: 4,
            transition: 'fade',
          },
        ],
      },
      // 逆セクハラCG（相手→プレイヤー）
      {
        id: 'blaze_foot_tease',
        triggerCard: 'foot_tease',
        requiredDrunkLevel: 2,
        cgColor: '#ff5577',
        dialogue: [
          { speaker: '', text: '――テーブルの下で、何かが足に触れた。' },
          { speaker: 'ブレイズ', text: '……ん？ どうしたのドクター、顔赤いよ？ お酒のせい？' },
          { speaker: 'ブレイズ', text: '……ふふ、違うよね。……わかってるくせに' },
          { speaker: 'ブレイズ', text: '（足先をゆっくり這わせながら）……ここ、弱いんだ？ ……知らなかったなぁ' },
          { speaker: 'ブレイズ', text: '……逃げないでよ。……私が飽きるまで、ね？' }
        ],
        frames: [
          {
            src: '/characters/blaze/cg/foot_tease_1.webp',
            label: 'テーブル下の気配',
            dialogueStart: 0,
            transition: 'fade',
          },
          {
            src: '/characters/blaze/cg/foot_tease_2.webp',
            label: '挑発する笑み',
            dialogueStart: 2,
            transition: 'zoom',
          },
          {
            src: '/characters/blaze/cg/foot_tease_3.webp',
            label: '攻めるブレイズ',
            dialogueStart: 3,
            transition: 'fade',
          },
        ],
      },
      {
        id: 'blaze_dirty_talk',
        triggerCard: 'dirty_talk',
        requiredDrunkLevel: 2,
        cgColor: '#ff4488',
        dialogue: [
          { speaker: 'ブレイズ', text: '（耳元に唇を寄せて）……ねぇ、ドクター' },
          { speaker: 'ブレイズ', text: '……今夜さ、帰れると思ってる？ ……甘いよ' },
          { speaker: 'ブレイズ', text: '……私がどれだけ我慢してたか……わかんないでしょ……' },
          { speaker: 'ブレイズ', text: '……このまま連れて帰っちゃうから。……覚悟、してね？' },
          { speaker: 'ブレイズ', text: '……あは、耳真っ赤。……可愛いなぁドクター' }
        ],
        frames: [
          {
            src: '/characters/blaze/cg/dirty_talk_1.webp',
            label: '耳元に近づく',
            dialogueStart: 0,
            transition: 'slide-left',
          },
          {
            src: '/characters/blaze/cg/dirty_talk_2.webp',
            label: '囁く表情',
            dialogueStart: 2,
            transition: 'zoom',
          },
          {
            src: '/characters/blaze/cg/dirty_talk_3.webp',
            label: '満足げな笑み',
            dialogueStart: 4,
            transition: 'fade',
          },
        ],
      }
    ],
    afterEvents: [
      {
        id: 'blaze_after_tipsy',
        requiredCGRate: 0.25,
        requiredWins: 1,
        title: 'ほろ酔いお持ち帰り',
        cgColor: '#e85d3a',
        emoji: '🌙',
        dialogue: [
          { speaker: '', text: '――バーを出ると、夜風が二人の頬を撫でた。' },
          { speaker: 'ブレイズ', text: 'んー……外、涼しい……ドクター、肩貸して……ちょっとだけ' },
          { speaker: 'ドクター', text: '（ブレイズの肩を抱き寄せる）' },
          { speaker: 'ブレイズ', text: '……えへへ。ドクターの肩、ちょうどいい高さ……' },
          { speaker: 'ブレイズ', text: '……ねぇ、このまま帰るの？ ……もうちょっとだけ、このままでいたい' },
          { speaker: 'ブレイズ', text: '……ドクターの匂い、好き……お酒と混ざって……ずるい匂い……' },
        ]
      },
      {
        id: 'blaze_after_drunk',
        requiredCGRate: 0.5,
        requiredWins: 3,
        title: 'ドクターの部屋で',
        cgColor: '#ff6b8a',
        emoji: '🛏️',
        dialogue: [
          { speaker: '', text: '――ドクターの部屋。ブレイズをベッドに座らせた。' },
          { speaker: 'ブレイズ', text: 'ん……ドクターの部屋、いい匂いする……なんか安心する……' },
          { speaker: 'ブレイズ', text: 'ねぇ……水、ちょうだい……あと、隣に座って……寒い……' },
          { speaker: 'ドクター', text: '（水を渡し、隣に腰を下ろす）' },
          { speaker: 'ブレイズ', text: '……ドクター。私さ、酔ってなくても……こうしたかったかも。' },
          { speaker: 'ブレイズ', text: '……嘘じゃないよ。……信じて。' },
          { speaker: 'ブレイズ', text: '……もっと近くに来て……ここ、空いてるから……ね？' },
          { speaker: 'ブレイズ', text: '（ブレイズがドクターの腕を掴み、ベッドに引き倒す）' },
          { speaker: 'ブレイズ', text: '……逃がさないって、言ったでしょ……？ ……ばか' },
        ]
      },
      {
        id: 'blaze_after_morning',
        requiredCGRate: 0.75,
        requiredWins: 5,
        title: '翌朝',
        cgColor: '#ffaa66',
        emoji: '🌅',
        dialogue: [
          { speaker: '', text: '――朝日がカーテンの隙間から差し込む。隣には温もりが残っている。' },
          { speaker: 'ブレイズ', text: '……ん……んん……まぶしい……' },
          { speaker: 'ブレイズ', text: '……あれ……ここ、ドクターの部屋……？ え、私なんで……' },
          { speaker: 'ブレイズ', text: '……っ！！ やっ、なんで私こんな格好……！ ドクター見ないでっ！！' },
          { speaker: 'ブレイズ', text: '……うそ、昨日のこと……覚えてる……全部……っ' },
          { speaker: 'ブレイズ', text: '……っ……ばか……私があんなこと言ったの……ドクターのせいだから……' },
          { speaker: 'ブレイズ', text: '…………でも。' },
          { speaker: 'ブレイズ', text: '……後悔は、してないよ。……またクロージャの店、行こ。……二人で。' },
        ]
      },
      {
        id: 'blaze_after_complete',
        requiredCGRate: 1.0,
        requiredWins: 8,
        title: '今夜は帰さない',
        cgColor: '#ff3355',
        emoji: '💕',
        dialogue: [
          { speaker: '', text: '――いつものバーで。クロージャが気を利かせて個室を用意してくれた。' },
          { speaker: 'ブレイズ', text: 'ドクター。……今日はさ、飲み比べとかいいよ。' },
          { speaker: 'ブレイズ', text: '……ただ、一緒に飲みたい。……ドクターと。' },
          { speaker: 'ドクター', text: '（グラスを合わせる。カチン、と澄んだ音が響く）' },
          { speaker: 'ブレイズ', text: '……ねぇ。私のこと、どう思ってる？ ……酔ってないよ、今は。' },
          { speaker: 'ブレイズ', text: '……そっか。……えへへ、やっぱドクターってずるいよね。' },
          { speaker: 'ブレイズ', text: '……今夜はさ。……帰さないから。覚悟、してね？' },
          { speaker: 'ブレイズ', text: '……嘘じゃないよ。……こうやって隣にいられるの、私は……すごく、嬉しい。' },
          { speaker: 'ブレイズ', text: '……ずっと、こうしてたいな。……ドクターと。' },
        ]
      },
    ]
  }
};
