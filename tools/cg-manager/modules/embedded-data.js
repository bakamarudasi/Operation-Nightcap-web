// ============================================================
// インライン埋め込みデータ（file://プロトコル時のCORSエラー回避用）
// characters.ts / cards.ts の内容がfetchできない場合のフォールバック
// ============================================================

const EMBEDDED_CHARACTERS_SRC = `
  blaze: {
    id: 'blaze',
    name: 'ブレイズ',
    nameEn: 'BLAZE',
    theme: { color: '#e85d3a' },
    costumeStates: [
      { level: 0, label: '通常', emoji: '👔', description: 'ロドスの制服をきっちり着ている', dishevelAmount: 0 },
      { level: 1, label: '少し緩む', emoji: '👕', description: '首元のボタンを外し、肩のラインが少し崩れている', dishevelAmount: 0.2 },
      { level: 2, label: '前はだけ', emoji: '💫', description: '「暑い」と言いながら前をはだけ、鎖骨と谷間がちらりと見える', dishevelAmount: 0.5 },
      { level: 3, label: '大胆に着崩れ', emoji: '🔥', description: '肩から服がずり落ち、下着の肩紐が見えている。太ももも露わに', dishevelAmount: 0.8 },
      { level: 4, label: 'ほぼ脱げ', emoji: '💋', description: '服が完全にはだけて下着姿同然。赤い頬で寝落ちしている', dishevelAmount: 1.0 },
    ],
    cgEvents: [
      { id: 'blaze_shoulder', triggerCard: 'shoulder_lean', requiredDrunkLevel: 1, cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（そっと肩を寄せ、耳元に顔を近づける）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！ ちょ、近い近い……息、当たってるんだけど……' },
          { speaker: 'ブレイズ', text: '……っ、なに、そんな近くで匂い嗅いでんの……変態じゃん……' },
          { speaker: 'ブレイズ', text: '………べ、別に嫌とは言ってないし。……もうちょっとだけ、くっついてていいよ' }
        ] },
      { id: 'blaze_headpat', triggerCard: 'headpat', requiredDrunkLevel: 2, cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（髪をかき上げ、うなじに指先をそっと這わせる）' },
          { speaker: 'ブレイズ', text: 'ひっ……！ そこ、だめ……うなじ弱いの知ってるでしょ……っ' },
          { speaker: 'ブレイズ', text: '……ん、指……冷たい……ぞくぞくする……やめてよ……' },
          { speaker: 'ブレイズ', text: '……やめてって言ってるのに……もっと奥まで触って……ばか' }
        ] },
      { id: 'blaze_breast', triggerCard: 'breast_touch', requiredDrunkLevel: 2, cgColor: '#ff6b8a',
        dialogue: [
          { speaker: 'ドクター', text: '（酔ったふりをして、ブレイズの胸にそっと手を当てる）' },
          { speaker: 'ブレイズ', text: 'ひゃっ……！！ ちょ、ど、どこ触って……っ！' },
          { speaker: 'ブレイズ', text: '……っ、ばか……酔ってるからって許されると思ってんの……？' },
          { speaker: 'ブレイズ', text: '……手、どけないの……？ ……どけなくて、いいけど……今だけだからね……っ' },
          { speaker: 'ブレイズ', text: '……ん……ドクターの手、あったかい……心臓、ばくばくしてるの……わかるでしょ……' }
        ],
        frames: [
          { label: '手が伸びる', dialogueStart: 0, transition: 'fade' },
          { label: '胸に触れる', dialogueStart: 1, transition: 'zoom' },
          { label: '感じてる表情', dialogueStart: 3, transition: 'fade' },
        ] },
      { id: 'blaze_hip', triggerCard: 'hip_touch', requiredDrunkLevel: 2, cgColor: '#ff7b6b',
        dialogue: [
          { speaker: 'ドクター', text: '（隣に座ったまま、ブレイズのお尻にそっと手を滑らせる）' },
          { speaker: 'ブレイズ', text: 'んっ……！ ちょ、待っ……そこ、お尻……っ！！' },
          { speaker: 'ブレイズ', text: '……信じらんない……こんなとこで何してんのドクター……変態……っ' },
          { speaker: 'ブレイズ', text: '……揉まないでよ……嘘、もうちょっとだけ……ぁ……だめ、声出ちゃう……' }
        ] },
      { id: 'blaze_ear', triggerCard: 'ear_bite', requiredDrunkLevel: 3, cgColor: '#ff5577',
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの耳たぶを唇でそっと挟む）' },
          { speaker: 'ブレイズ', text: 'ひぁっ……！！ み、耳はだめっ……感じる……っ！' },
          { speaker: 'ブレイズ', text: '……んっ、舌……やだ、ぞくぞくする……もう、だめ……' },
          { speaker: 'ブレイズ', text: '……ドクター、最低……こんなの……もっと、して……' },
          { speaker: 'ブレイズ', text: '……もう帰さないから……今夜は覚悟してよね……' }
        ],
        frames: [
          { label: '耳に顔を近づける', dialogueStart: 0, transition: 'slide-left' },
          { label: '耳たぶを噛む', dialogueStart: 1, transition: 'zoom' },
          { label: '蕩けた表情', dialogueStart: 3, transition: 'fade' },
        ] },
      { id: 'blaze_lap', triggerCard: 'lap_pillow', requiredDrunkLevel: 3, cgColor: '#e85d3a',
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの頭をそっと膝に導き、髪を指に絡める）' },
          { speaker: 'ブレイズ', text: 'え、ちょ……膝枕とか……んっ、髪、触んないでよ……くすぐったい……' },
          { speaker: 'ブレイズ', text: 'ドクターの太もも……あったかい……すごい、心臓の音聞こえる……' },
          { speaker: 'ブレイズ', text: '……ねぇ、このまま寝ちゃったら……何する気？ ……してもいいよ、今なら……' },
          { speaker: 'ブレイズ', text: '……ん……もう動けない……ドクターの匂い……好き……zzZ' }
        ] },
      { id: 'blaze_kiss', triggerCard: 'kiss', requiredDrunkLevel: 3, cgColor: '#ff4466', instantWin: true,
        dialogue: [
          { speaker: 'ドクター', text: '（ブレイズの腰を引き寄せ、唇に指を添える）' },
          { speaker: 'ブレイズ', text: '……え、うそ……マジで……？ こんな近くで見つめないでよ……' },
          { speaker: 'ブレイズ', text: '……心臓、止まりそう……ドクターの息、甘い……' },
          { speaker: 'ブレイズ', text: '………ん……っ' },
          { speaker: 'ブレイズ', text: '……ばか。もう遅いよ。……朝まで、逃がさないから' }
        ],
        frames: [
          { label: '腰を引き寄せる', dialogueStart: 0, transition: 'fade' },
          { label: '唇が近づく', dialogueStart: 2, transition: 'zoom' },
          { label: 'キス', dialogueStart: 3, transition: 'fade' },
          { label: '余韻', dialogueStart: 4, transition: 'fade' },
        ] },
      { id: 'blaze_foot_tease', triggerCard: 'foot_tease', requiredDrunkLevel: 2, cgColor: '#ff5577',
        dialogue: [
          { speaker: '', text: '――テーブルの下で、何かが足に触れた。' },
          { speaker: 'ブレイズ', text: '……ん？ どうしたのドクター、顔赤いよ？ お酒のせい？' },
          { speaker: 'ブレイズ', text: '……ふふ、違うよね。……わかってるくせに' },
          { speaker: 'ブレイズ', text: '（足先をゆっくり這わせながら）……ここ、弱いんだ？ ……知らなかったなぁ' },
          { speaker: 'ブレイズ', text: '……逃げないでよ。……私が飽きるまで、ね？' }
        ],
        frames: [
          { label: 'テーブル下の気配', dialogueStart: 0, transition: 'fade' },
          { label: '挑発する笑み', dialogueStart: 2, transition: 'zoom' },
          { label: '攻めるブレイズ', dialogueStart: 3, transition: 'fade' },
        ] },
      { id: 'blaze_dirty_talk', triggerCard: 'dirty_talk', requiredDrunkLevel: 2, cgColor: '#ff4488',
        dialogue: [
          { speaker: 'ブレイズ', text: '（耳元に唇を寄せて）……ねぇ、ドクター' },
          { speaker: 'ブレイズ', text: '……今夜さ、帰れると思ってる？ ……甘いよ' },
          { speaker: 'ブレイズ', text: '……私がどれだけ我慢してたか……わかんないでしょ……' },
          { speaker: 'ブレイズ', text: '……このまま連れて帰っちゃうから。……覚悟、してね？' },
          { speaker: 'ブレイズ', text: '……あは、耳真っ赤。……可愛いなぁドクター' }
        ],
        frames: [
          { label: '耳元に近づく', dialogueStart: 0, transition: 'slide-left' },
          { label: '囁く表情', dialogueStart: 2, transition: 'zoom' },
          { label: '満足げな笑み', dialogueStart: 4, transition: 'fade' },
        ] }
    ],
    afterEvents: [
      { id: 'blaze_after_tipsy', requiredCGRate: 0.25, requiredWins: 1, title: 'ほろ酔いお持ち帰り', cgColor: '#e85d3a', emoji: '🌙',
        dialogue: [
          { speaker: '', text: '――バーを出ると、夜風が二人の頬を撫でた。' },
          { speaker: 'ブレイズ', text: 'んー……外、涼しい……ドクター、肩貸して……ちょっとだけ' },
          { speaker: 'ドクター', text: '（ブレイズの肩を抱き寄せる）' },
          { speaker: 'ブレイズ', text: '……えへへ。ドクターの肩、ちょうどいい高さ……' },
          { speaker: 'ブレイズ', text: '……ねぇ、このまま帰るの？ ……もうちょっとだけ、このままでいたい' },
          { speaker: 'ブレイズ', text: '……ドクターの匂い、好き……お酒と混ざって……ずるい匂い……' }
        ] },
      { id: 'blaze_after_drunk', requiredCGRate: 0.5, requiredWins: 3, title: 'ドクターの部屋で', cgColor: '#ff6b8a', emoji: '🛏️',
        dialogue: [
          { speaker: '', text: '――ドクターの部屋。ブレイズをベッドに座らせた。' },
          { speaker: 'ブレイズ', text: 'ん……ドクターの部屋、いい匂いする……なんか安心する……' },
          { speaker: 'ブレイズ', text: 'ねぇ……水、ちょうだい……あと、隣に座って……寒い……' },
          { speaker: 'ドクター', text: '（水を渡し、隣に腰を下ろす）' },
          { speaker: 'ブレイズ', text: '……ドクター。私さ、酔ってなくても……こうしたかったかも。' },
          { speaker: 'ブレイズ', text: '……嘘じゃないよ。……信じて。' },
          { speaker: 'ブレイズ', text: '……もっと近くに来て……ここ、空いてるから……ね？' },
          { speaker: 'ブレイズ', text: '（ブレイズがドクターの腕を掴み、ベッドに引き倒す）' },
          { speaker: 'ブレイズ', text: '……逃がさないって、言ったでしょ……？ ……ばか' }
        ] },
      { id: 'blaze_after_morning', requiredCGRate: 0.75, requiredWins: 5, title: '翌朝', cgColor: '#ffaa66', emoji: '🌅',
        dialogue: [
          { speaker: '', text: '――朝日がカーテンの隙間から差し込む。隣には温もりが残っている。' },
          { speaker: 'ブレイズ', text: '……ん……んん……まぶしい……' },
          { speaker: 'ブレイズ', text: '……あれ……ここ、ドクターの部屋……？ え、私なんで……' },
          { speaker: 'ブレイズ', text: '……っ！！ やっ、なんで私こんな格好……！ ドクター見ないでっ！！' },
          { speaker: 'ブレイズ', text: '……うそ、昨日のこと……覚えてる……全部……っ' },
          { speaker: 'ブレイズ', text: '……っ……ばか……私があんなこと言ったの……ドクターのせいだから……' },
          { speaker: 'ブレイズ', text: '…………でも。' },
          { speaker: 'ブレイズ', text: '……後悔は、してないよ。……またクロージャの店、行こ。……二人で。' }
        ] },
      { id: 'blaze_after_complete', requiredCGRate: 1.0, requiredWins: 8, title: '今夜は帰さない', cgColor: '#ff3355', emoji: '💕',
        dialogue: [
          { speaker: '', text: '――いつものバーで。クロージャが気を利かせて個室を用意してくれた。' },
          { speaker: 'ブレイズ', text: 'ドクター。……今日はさ、飲み比べとかいいよ。' },
          { speaker: 'ブレイズ', text: '……ただ、一緒に飲みたい。……ドクターと。' },
          { speaker: 'ドクター', text: '（グラスを合わせる。カチン、と澄んだ音が響く）' },
          { speaker: 'ブレイズ', text: '……ねぇ。私のこと、どう思ってる？ ……酔ってないよ、今は。' },
          { speaker: 'ブレイズ', text: '……そっか。……えへへ、やっぱドクターってずるいよね。' },
          { speaker: 'ブレイズ', text: '……今夜はさ。……帰さないから。覚悟、してね？' },
          { speaker: 'ブレイズ', text: '……嘘じゃないよ。……こうやって隣にいられるの、私は……すごく、嬉しい。' },
          { speaker: 'ブレイズ', text: '……ずっと、こうしてたいな。……ドクターと。' }
        ] },
    ]
  }
`;

const EMBEDDED_CARDS_SRC = `
  beer: { id: 'beer', name: '龍門ラガー', emoji: '🍺', type: 'drink' },
  wine: { id: 'wine', name: 'ヴィクトリア産熟成赤', emoji: '🍷', type: 'drink' },
  whiskey: { id: 'whiskey', name: 'ウルサス原酒ストレート', emoji: '🥃', type: 'drink' },
  baijiu: { id: 'baijiu', name: '炎国・茅台酒', emoji: '🍶', type: 'drink' },
  cocktail: { id: 'cocktail', name: 'ペンギン急便スペシャル', emoji: '🧊', type: 'drink' },
  nuts: { id: 'nuts', name: '行軍糧食', emoji: '🥜', type: 'food' },
  yakitori: { id: 'yakitori', name: '龍門屋台の串焼き', emoji: '🍖', type: 'food' },
  ramen: { id: 'ramen', name: '龍門式老火麺', emoji: '🍜', type: 'food' },
  ukon: { id: 'ukon', name: 'ケルシー処方薬', emoji: '💊', type: 'food' },
  rumor: { id: 'rumor', name: '龍門の噂話', emoji: '🗣️', type: 'strategy' },
  excuse: { id: 'excuse', name: '「酔ってるから」', emoji: '🙈', type: 'strategy' },
  distract: { id: 'distract', name: '話題転換', emoji: '👁️', type: 'strategy' },
  karaoke: { id: 'karaoke', name: 'カラオケ2次会', emoji: '🎤', type: 'environment' },
  lastorder: { id: 'lastorder', name: 'ラストオーダー', emoji: '🔔', type: 'environment' },
  dimlight: { id: 'dimlight', name: '照明を落とす', emoji: '🕯️', type: 'environment' },
  tipsy: { id: 'tipsy', name: 'ほろ酔い状態', emoji: '😳', type: 'status' },
  blush: { id: 'blush', name: '顔が赤い', emoji: '😶‍🌫️', type: 'status' },
  alone: { id: 'alone', name: '二人きり', emoji: '🌙', type: 'status' },
  chug: { id: 'chug', name: 'レユニオン式気合注入', emoji: '🍻', type: 'chug' },
  toast: { id: 'toast', name: '強制乾杯令', emoji: '🥂', type: 'chug' },
  spill: { id: 'spill', name: 'わざとこぼし', emoji: '🫗', type: 'chug' },
  shoulder_lean: { id: 'shoulder_lean', name: '耳元でささやく', emoji: '💋', type: 'harassment', requiredDrunkLevel: 1, drunkDamage: 1 },
  headpat: { id: 'headpat', name: 'うなじを撫でる', emoji: '🫳', type: 'harassment', requiredDrunkLevel: 2, drunkDamage: 1 },
  breast_touch: { id: 'breast_touch', name: '胸に触れる', emoji: '🫦', type: 'harassment', requiredDrunkLevel: 2, drunkDamage: 3 },
  hip_touch: { id: 'hip_touch', name: 'お尻をなでる', emoji: '🍑', type: 'harassment', requiredDrunkLevel: 2, drunkDamage: 2 },
  ear_bite: { id: 'ear_bite', name: '耳を甘噛み', emoji: '👅', type: 'harassment', requiredDrunkLevel: 3, drunkDamage: 3 },
  kiss: { id: 'kiss', name: 'ディープキス', emoji: '💋', type: 'harassment', requiredDrunkLevel: 3, instantWin: true },
  lap_pillow: { id: 'lap_pillow', name: '膝枕', emoji: '🛌', type: 'harassment', requiredDrunkLevel: 3, drunkDamage: 2 },
  fix_collar: { id: 'fix_collar', name: '襟を直してあげる', emoji: '👔', type: 'harassment', requiredDrunkLevel: 1, drunkDamage: 1 },
  check_pulse: { id: 'check_pulse', name: '脈を測る', emoji: '💓', type: 'harassment', requiredDrunkLevel: 1, drunkDamage: 1 },
  foot_tease: { id: 'foot_tease', name: 'テーブルの下の足首', emoji: '🦶', type: 'harassment', requiredDrunkLevel: 2, sanityDamage: 3 },
  dirty_talk: { id: 'dirty_talk', name: '淫らな耳元囁き', emoji: '👄', type: 'harassment', requiredDrunkLevel: 2, sanityDamage: 2 },
`;
