# CLOSURE'S BAR ～今夜は帰さない～ 技術仕様書

## 概要

飲み会カード対戦ゲーム。プレイヤー（ドクター）がキャラクターと酒を飲み交わし、
先に相手を酔い潰した方が勝ち。酔い度に応じて CG イベントが解放される。

---

## 技術スタック

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| React | 19 | UI コンポーネント |
| Vite | 6 | ビルドツール（HMR） |
| TypeScript | 5 | 型安全 |
| Zustand | 5 | 状態管理（persist で LocalStorage 保存） |
| Framer Motion | 12 | アニメーション（カード演出・立ち絵・CG） |
| CSS Modules | ― | スコープ付きスタイリング |

---

## フォルダ構成

```
src/
├── main.tsx                       # エントリポイント
├── App.tsx                        # ルート（画面切替）
│
├── assets/                        # 画像・音声（import で参照）
│   ├── characters/{id}/
│   │   ├── portrait.webp          # 立ち絵
│   │   ├── select-icon.webp       # 選択画面用
│   │   └── cg/
│   │       └── {event}.webp       # CG イベント画像
│   ├── cards/{cardId}.webp        # カードイラスト
│   ├── ui/                        # 背景・ロゴ・カード裏面
│   └── audio/                     # BGM・SE
│
├── types/                         # 共有型定義
│   └── index.ts
│
├── data/                          # マスターデータ（TS 直書き）
│   ├── cards.ts
│   ├── characters.ts
│   └── shop.ts
│
├── stores/                        # Zustand ストア
│   ├── useGameStore.ts            # 永続データ（money, deck, CGs）
│   ├── useBattleStore.ts          # バトル中の揮発データ
│   └── useSettingsStore.ts        # ユーザー設定
│
├── engine/                        # ゲームロジック（UI 非依存・純粋関数）
│   ├── battle.ts
│   ├── ai.ts
│   └── utils.ts
│
├── screens/                       # 画面コンポーネント
│   ├── TitleScreen/
│   ├── SelectScreen/
│   ├── BattleScreen/
│   ├── ShopScreen/
│   └── GalleryScreen/
│
├── components/                    # 再利用 UI パーツ
│   ├── Card/
│   ├── DrunkGauge/
│   ├── DialogueBox/
│   ├── CGOverlay/
│   ├── CharacterSprite/
│   └── HandArea/
│
├── hooks/                         # カスタムフック
│   └── useTypewriter.ts
│
└── styles/                        # グローバル CSS
    ├── global.css
    └── variables.css
```

---

## 型定義（types/index.ts）

```ts
// ─── カード ───

export type CardType = 'drink' | 'food' | 'chug' | 'harassment';

export type CardId =
  | 'beer' | 'wine' | 'whiskey' | 'baijiu' | 'cocktail'
  | 'nuts' | 'yakitori' | 'ramen' | 'ukon'
  | 'chug' | 'toast' | 'spill'
  | 'shoulder_lean' | 'headpat' | 'gaze' | 'lap_pillow' | 'kiss';

/** カード共通フィールド */
interface CardBase {
  id: CardId;
  name: string;
  emoji: string;
  type: CardType;
  description: string;
  rarity: number;
  price: number;
}

/** ドリンクカード */
export interface DrinkCard extends CardBase {
  type: 'drink';
  damage: number;        // -1 = ランダム(1~3)
}

/** つまみカード */
export interface FoodCard extends CardBase {
  type: 'food';
  heal: number;          // 99 = 全回復
}

/** 一気飲みカード */
export interface ChugCard extends CardBase {
  type: 'chug';
  effect: 'chug' | 'toast' | 'spill';
  enemyDamage?: number;
  selfDamage?: number;
}

/** セクハラカード（CG 発動） */
export interface HarassmentCard extends CardBase {
  type: 'harassment';
  requiredDrunkLevel: number;
  drunkDamage?: number;
  instantWin?: boolean;
}

export type Card = DrinkCard | FoodCard | ChugCard | HarassmentCard;

// ─── キャラクター ───

export type CharacterId = 'blaze'; // 今後追加

export type DrunkLevelValue = 0 | 1 | 2 | 3 | 4;

export interface DrunkLevel {
  level: DrunkLevelValue;
  name: string;           // 'シラフ' | 'ほろ酔い' | '酔い' | 'べろべろ' | '潰れ'
  threshold: number;
  lines: string[];
}

export interface CGEvent {
  id: string;
  triggerCard: CardId;
  requiredDrunkLevel: number;
  cgColor: string;
  instantWin?: boolean;
  dialogue: DialogueLine[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export type AIPersonality = 'aggressive' | 'defensive' | 'balanced';

export interface Character {
  id: CharacterId;
  name: string;
  nameEn: string;
  subtitle: string;
  theme: {
    color: string;
    colorDark: string;
    colorGlow: string;
    icon: string;
  };
  drunkType: string;
  drunkMax: number;
  drunkLevels: DrunkLevel[];
  battleLines: {
    playDrink: string[];
    playFood: string[];
    playChug: string[];
    takeDamage: string[];
    dealDamage: string[];
    harassmentSuccess: string[];
    harassmentFail: string[];
    winLine: string;
    loseLine: string;
  };
  deck_ai: {
    personality: AIPersonality;
    defaultDeck: CardId[];
  };
  cgEvents: CGEvent[];
}

// ─── ゲーム状態 ───

export type ScreenId = 'title' | 'select' | 'battle' | 'shop' | 'gallery';

export interface RoundResult {
  playerCard: Card;
  opponentCard: Card;
  playerDamage: number;
  opponentDamage: number;
  playerHeal: number;
  opponentHeal: number;
  messages: string[];
  cgEvent: CGEvent | null;
  instantWin: boolean;
  spillNullified: boolean;
}

export type GameEndResult = 'player_win' | 'opponent_win' | 'draw' | null;
```

---

## 状態管理（Zustand ストア）

### useGameStore — 永続データ

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameStore {
  // === 状態 ===
  money: number;
  playerDeck: CardId[];
  unlockedCGs: string[];        // Set → 配列（JSON シリアライズ対応）
  wins: number;
  losses: number;
  currentScreen: ScreenId;

  // === アクション ===
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;  // 残高不足なら false
  addCardToDeck: (cardId: CardId) => boolean;
  removeCardFromDeck: (index: number) => void;
  unlockCG: (cgId: string) => void;
  isCGUnlocked: (cgId: string) => boolean;
  addWin: () => void;
  addLoss: () => void;
  setScreen: (screen: ScreenId) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      money: 3200,
      playerDeck: DEFAULT_DECK,
      unlockedCGs: [],
      wins: 0,
      losses: 0,
      currentScreen: 'title',

      addMoney: (amount) => set((s) => ({ money: s.money + amount })),

      spendMoney: (amount) => {
        if (get().money < amount) return false;
        set((s) => ({ money: s.money - amount }));
        return true;
      },

      addCardToDeck: (cardId) => {
        if (get().playerDeck.length >= 12) return false;
        set((s) => ({ playerDeck: [...s.playerDeck, cardId] }));
        return true;
      },

      removeCardFromDeck: (index) =>
        set((s) => ({
          playerDeck: s.playerDeck.filter((_, i) => i !== index),
        })),

      unlockCG: (cgId) =>
        set((s) => ({
          unlockedCGs: s.unlockedCGs.includes(cgId)
            ? s.unlockedCGs
            : [...s.unlockedCGs, cgId],
        })),

      isCGUnlocked: (cgId) => get().unlockedCGs.includes(cgId),

      addWin: () => set((s) => ({ wins: s.wins + 1 })),
      addLoss: () => set((s) => ({ losses: s.losses + 1 })),
      setScreen: (screen) => set({ currentScreen: screen }),
    }),
    {
      name: 'closures-bar-save',     // localStorage キー
    }
  )
);
```

### useBattleStore — バトル中の揮発データ

```ts
interface BattleStore {
  // === 状態 ===
  round: number;
  maxRounds: number;
  playerDrunk: number;
  opponentDrunk: number;
  playerHand: CardId[];
  opponentHand: CardId[];
  playerDeckRemaining: CardId[];
  opponentDeckRemaining: CardId[];
  selectedCard: CardId | null;
  isProcessing: boolean;
  opponent: Character | null;

  // 特殊効果
  opponentDiscardNext: boolean;
  playerReducedHand: boolean;
  spillActive: boolean;

  // === アクション ===
  initBattle: (opponent: Character, playerDeck: CardId[]) => void;
  selectCard: (cardId: CardId) => void;
  drawHands: () => void;
  resolveRound: (playerCardId: CardId) => RoundResult;
  checkGameEnd: () => GameEndResult;
  reset: () => void;
}
```

> `useBattleStore` は `persist` しない（バトル中にブラウザ閉じたらリセット）。

### useSettingsStore — ユーザー設定

```ts
interface SettingsStore {
  bgmVolume: number;       // 0.0 ~ 1.0
  seVolume: number;        // 0.0 ~ 1.0
  textSpeed: number;       // タイプライター速度（ms/文字）
  setBgmVolume: (v: number) => void;
  setSeVolume: (v: number) => void;
  setTextSpeed: (v: number) => void;
}
```

> `persist` で LocalStorage に保存。

---

## コンポーネント設計（Props 仕様）

### 画面コンポーネント（screens/）

画面コンポーネントは **props を受け取らない**。
Zustand ストアから直接状態を取得する。

```tsx
// screens/TitleScreen/TitleScreen.tsx
export const TitleScreen = () => {
  const money = useGameStore((s) => s.money);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>CLOSURE'S BAR</h1>
      <p className={styles.subtitle}>～今夜は帰さない～</p>
      <button onClick={() => setScreen('select')}>🍷 対戦する</button>
      <button onClick={() => setScreen('shop')}>🏪 ショップ</button>
      <button onClick={() => setScreen('gallery')}>🖼️ CGギャラリー</button>
      <div>💰 {money} 龍門幣</div>
    </div>
  );
};
```

### 再利用コンポーネント（components/）

再利用コンポーネントは **props で受け取る**（ストア非依存にして再利用性を確保）。

#### Card

```tsx
interface CardProps {
  card: Card;
  /** 裏面表示か */
  faceDown?: boolean;
  /** 選択中ハイライト */
  selected?: boolean;
  /** カード画像（import 済み URL） */
  imageUrl?: string;
  /** クリック時 */
  onClick?: () => void;
  /** 無効状態（処理中等） */
  disabled?: boolean;
}

export const Card = ({ card, faceDown, selected, imageUrl, onClick, disabled }: CardProps) => {
  return (
    <motion.div
      className={clsx(styles.card, {
        [styles.selected]: selected,
        [styles.faceDown]: faceDown,
        [styles.disabled]: disabled,
      })}
      onClick={disabled ? undefined : onClick}
      whileHover={!disabled ? { y: -8, scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      layout
    >
      {faceDown ? (
        <div className={styles.cardBack}>?</div>
      ) : (
        <>
          <div className={styles.emoji}>{card.emoji}</div>
          <div className={styles.name}>{card.name}</div>
          {imageUrl && <img src={imageUrl} alt={card.name} className={styles.image} />}
          <div className={styles.description}>{card.description}</div>
        </>
      )}
    </motion.div>
  );
};
```

#### DrunkGauge

```tsx
interface DrunkGaugeProps {
  /** 現在の酔い値 (0~10) */
  value: number;
  /** 最大値 */
  max?: number;
  /** ラベル（"相手の酔い" / "ドクターの酔い"） */
  label: string;
  /** レベル表示テキスト（"Lv.2 酔い"） */
  levelText: string;
  /** テーマカラー */
  color?: string;
}

export const DrunkGauge = ({ value, max = 10, label, levelText, color }: DrunkGaugeProps) => {
  const percent = Math.min(100, (value / max) * 100);

  return (
    <div className={styles.container}>
      <div className={styles.label}>{label}</div>
      <div className={styles.track}>
        <motion.div
          className={styles.fill}
          style={{ backgroundColor: color }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 200 }}
        />
      </div>
      <div className={styles.text}>{levelText} ({value}/{max})</div>
    </div>
  );
};
```

#### DialogueBox

```tsx
interface DialogueBoxProps {
  /** 話者名 */
  speaker: string;
  /** セリフテキスト */
  text: string;
  /** タイプライター完了コールバック */
  onComplete?: () => void;
}
```

#### CGOverlay

```tsx
interface CGOverlayProps {
  /** 表示する CG イベント */
  cgEvent: CGEvent;
  /** CG 画像 URL（import 済み） */
  imageUrl?: string;
  /** 閉じた時のコールバック */
  onClose: () => void;
}
```

#### CharacterSprite

```tsx
interface CharacterSpriteProps {
  /** キャラ ID */
  characterId: CharacterId;
  /** 立ち絵 URL（import 済み） */
  imageUrl: string;
  /** 酔いレベル（表情差分用） */
  drunkLevel: DrunkLevelValue;
}
```

#### HandArea

```tsx
interface HandAreaProps {
  /** 手札のカード ID 配列 */
  hand: CardId[];
  /** 選択中のカード ID */
  selectedCard: CardId | null;
  /** カード選択コールバック */
  onSelectCard: (cardId: CardId) => void;
  /** 操作不可（処理中） */
  disabled: boolean;
}
```

---

## 画面遷移

```
  ┌──────────┐
  │  Title   │ ← currentScreen で切替（React の条件レンダリング）
  └────┬─────┘
       │
  ┌────┴──────┬──────────┐
  ▼           ▼          ▼
┌──────┐  ┌──────┐  ┌────────┐
│Select│  │ Shop │  │Gallery │
└──┬───┘  └──────┘  └────────┘
   │
   ▼
┌──────┐
│Battle│ → 勝敗結果 → Title に戻る
└──────┘
```

```tsx
// App.tsx
export const App = () => {
  const screen = useGameStore((s) => s.currentScreen);

  return (
    <AnimatePresence mode="wait">
      {screen === 'title'   && <TitleScreen   key="title" />}
      {screen === 'select'  && <SelectScreen  key="select" />}
      {screen === 'battle'  && <BattleScreen  key="battle" />}
      {screen === 'shop'    && <ShopScreen    key="shop" />}
      {screen === 'gallery' && <GalleryScreen key="gallery" />}
    </AnimatePresence>
  );
};
```

> `AnimatePresence` で画面切替時のフェードイン/アウトを実現。
> React Router は **使わない**（SPA 内の画面切替はストアで十分）。

---

## ゲームフロー

```
1. タイトル画面
   └→ 「対戦する」→ 対戦相手選択

2. 対戦相手選択
   └→ キャラ選択 → バトル画面へ

3. バトル（最大12ラウンド）
   ├── initBattle() → デッキシャッフル
   └── 各ラウンド:
       ├── drawHands()        → 手札配布
       ├── プレイヤーがカード選択
       ├── AI がカード選択     → ai.selectCard()
       ├── resolveRound()      → 効果解決
       ├── CG イベント発動?   → CGOverlay 表示
       ├── DrunkGauge 更新
       ├── checkGameEnd()     → 勝敗判定
       └── 次のラウンドへ / 結果表示

4. 結果表示
   └→ 報酬付与 → タイトルへ

5. ショップ
   └→ カード売買・デッキ編集

6. CG ギャラリー
   └→ 解放済み CG を再閲覧
```

---

## カードデータ一覧

### ドリンクカード（攻撃）

| ID | 名前 | 絵文字 | ダメージ | レア度 | 価格 |
|----|------|--------|---------|--------|------|
| `beer` | ビール | 🍺 | 1 | ★ | 100 |
| `wine` | ワイン | 🍷 | 2 | ★★ | 300 |
| `whiskey` | ウイスキー | 🥃 | 3 | ★★★ | 500 |
| `baijiu` | 白酒 | 🍶 | 4 | ★★★★ | 800 |
| `cocktail` | カクテル | 🧊 | 1~3 | ★★ | 400 |

### つまみカード（回復）

| ID | 名前 | 絵文字 | 回復量 | レア度 | 価格 |
|----|------|--------|--------|--------|------|
| `nuts` | ナッツ | 🥜 | 1 | ★ | 100 |
| `yakitori` | 焼き鳥 | 🍖 | 2 | ★★ | 300 |
| `ramen` | ラーメン | 🍜 | 3 | ★★★ | 600 |
| `ukon` | ウコン | 💊 | 全回復 | ★★★★★ | 1200 |

### 一気飲みカード（ハイリスク）

| ID | 名前 | 絵文字 | 効果 | レア度 | 価格 |
|----|------|--------|------|--------|------|
| `chug` | 一気飲み | 🍻 | 相手+3 自分+1 | ★★★ | 800 |
| `toast` | 乾杯強制 | 🥂 | 相手+2 自分+1 + 手札破棄 | ★★★ | 700 |
| `spill` | こぼし | 🫗 | 相手カード無効化（次R手札-1） | ★★ | 500 |

### セクハラカード（CG発動）

| ID | 名前 | 絵文字 | 条件 | 効果 | レア度 | 価格 |
|----|------|--------|------|------|--------|------|
| `shoulder_lean` | 肩を寄せる | 💋 | 酔Lv≧1 | 酔い+1 + CG | ★★★★ | 1500 |
| `headpat` | 頭ポンポン | 🫳 | 酔Lv≧2 | 酔い+1 + CG | ★★★★ | 1500 |
| `gaze` | 見つめる | 👀 | 酔Lv≧2 | 酔い+2 + CG | ★★★★ | 2000 |
| `lap_pillow` | 膝枕する | 💕 | 酔Lv≧3 | 酔い+2 + CG | ★★★★★ | 3000 |
| `kiss` | キス | 💋 | 酔Lv≧3 | 即勝利 + CG | ★★★★★★ | 5000 |

---

## 酔いレベル

| レベル | 名前 | 酔い値 | 演出 |
|--------|------|--------|------|
| 0 | シラフ | 0~1 | 通常 |
| 1 | ほろ酔い | 2~3 | 頬赤らむ、セリフ変化 |
| 2 | 酔い | 4~6 | 揺れ、声色変化 |
| 3 | べろべろ | 7~9 | 大揺れ、甘えセリフ |
| 4 | 潰れ | 10 | ゲーム終了 |

---

## バトル解決ルール

```
ドリンク vs ドリンク → 差分ダメージ（高い方が通る）
ドリンク vs つまみ   → ドリンクのダメージ適用後、つまみで回復
つまみ   vs つまみ   → 何も起きない（平和）
一気飲み系           → 相手カード無視で効果発動
セクハラ             → 酔いLv条件チェック → 成功: CG + ダメージ / 不発
```

---

## CG カットイン演出仕様

セクハラカードが成功した時、バトル画面の上に CG シーンがカットインで割り込む。

### 発動条件

```
セクハラカード出す → resolveRound() で酔いLv条件チェック
  ├── 不発: セリフだけ表示して通常ラウンドに戻る
  └── 成功: RoundResult.cgEvent に CGEvent がセットされる
            → BattleScreen が cgEvent を検知して CGOverlay を表示
```

### カットイン演出タイムライン

```
時間(ms)   演出
─────────────────────────────────────────────────────
  0        画面フリーズ（バトルUI操作不可に）
  0~200    ① フラッシュ — 画面全体が白く光る（opacity 0→1→0）
200~500    ② スラッシュイン — CG画像が画面外から斜めにスライドイン
           　 背景は暗転（黒 opacity 0→0.7）
500~700    ③ CG画像がバウンドして定位置に着地
           　 スプリングアニメーション（overshoot → settle）
700~       ④ テキストボックスが下からフェードイン
           　 話者名 + タイプライターでセリフ表示
  ↓        ⑤ クリック/タップで次のセリフへ
           　 （タイプ途中 → 全文即表示、完了後 → 次のセリフ）
  ↓        ⑥ 最後のセリフ後、クリックで閉じる
           　 CG画像がフェードアウト + スケールダウン
           　 暗転解除
  ↓        ⑦ バトル画面に復帰（操作可能に）
```

### 視覚イメージ

```
┌─────────────────────────────────┐
│          バトル画面              │ ← 暗転オーバーレイ (黒 70%)
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │      CG イラスト           │  │ ← 中央に配置、角丸 + ドロップシャドウ
│  │      (画像 or カラー背景)  │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ブレイズ                   │  │ ← テキストボックス
│  │ 「……べつに、嫌じゃねーけど │  │    タイプライター表示
│  │   。今日だけだからな」     │  │
│  │               ▶ 次へ      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### CGOverlay コンポーネント（詳細）

```tsx
interface CGOverlayProps {
  /** 表示する CG イベント */
  cgEvent: CGEvent;
  /** CG 画像 URL（import 済み。未指定時はカラーフォールバック） */
  imageUrl?: string;
  /** キャラのテーマカラー（テキストボックス色に使う） */
  themeColor?: string;
  /** 全セリフ終了後に呼ばれるコールバック */
  onClose: () => void;
}

interface CGOverlayState {
  /** 現在のアニメーションフェーズ */
  phase: 'flash' | 'slide-in' | 'dialogue' | 'closing';
  /** 現在表示中のセリフインデックス */
  dialogueIndex: number;
  /** タイプライターが完了したか */
  typewriterDone: boolean;
}
```

### Framer Motion バリアント定義

```tsx
// ① フラッシュ
const flashVariants = {
  initial: { opacity: 0 },
  flash:   { opacity: [0, 1, 0], transition: { duration: 0.2, times: [0, 0.5, 1] } },
};

// ② CG画像スライドイン
const cgImageVariants = {
  initial: { x: '120%', rotate: 8, scale: 0.9 },
  enter:   {
    x: 0, rotate: 0, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }
  },
  exit:    {
    opacity: 0, scale: 0.8,
    transition: { duration: 0.3 }
  },
};

// ③ 暗転背景
const backdropVariants = {
  initial: { opacity: 0 },
  enter:   { opacity: 0.7, transition: { duration: 0.3 } },
  exit:    { opacity: 0,   transition: { duration: 0.3 } },
};

// ④ テキストボックス
const textboxVariants = {
  initial: { y: 60, opacity: 0 },
  enter:   {
    y: 0, opacity: 1,
    transition: { type: 'spring', stiffness: 200, damping: 25, delay: 0.5 }
  },
  exit:    { y: 30, opacity: 0, transition: { duration: 0.2 } },
};
```

### CGOverlay 実装イメージ

```tsx
export const CGOverlay = ({ cgEvent, imageUrl, themeColor, onClose }: CGOverlayProps) => {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const { displayedText, isComplete, skipToEnd } = useTypewriter(
    cgEvent.dialogue[dialogueIndex]?.text ?? '',
    { speed: 30 }
  );

  const currentLine = cgEvent.dialogue[dialogueIndex];
  const isLastLine = dialogueIndex >= cgEvent.dialogue.length - 1;

  const handleClick = () => {
    if (!isComplete) {
      skipToEnd();                        // タイプ途中 → 全文表示
    } else if (isLastLine) {
      onClose();                          // 最後のセリフ → 閉じる
    } else {
      setDialogueIndex((i) => i + 1);    // 次のセリフへ
    }
  };

  return (
    <motion.div className={styles.overlay} onClick={handleClick}>
      {/* 暗転背景 */}
      <motion.div className={styles.backdrop}
        variants={backdropVariants} initial="initial" animate="enter" exit="exit"
      />

      {/* フラッシュ */}
      <motion.div className={styles.flash}
        variants={flashVariants} initial="initial" animate="flash"
      />

      {/* CG画像 */}
      <motion.div className={styles.cgImage}
        variants={cgImageVariants} initial="initial" animate="enter" exit="exit"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={cgEvent.id} />
        ) : (
          <div className={styles.cgPlaceholder}
            style={{ background: `linear-gradient(135deg, ${themeColor}44, ${themeColor}88)` }}
          >
            <span className={styles.placeholderEmoji}>
              {CARD_DATA[cgEvent.triggerCard]?.emoji ?? '💫'}
            </span>
          </div>
        )}
      </motion.div>

      {/* テキストボックス */}
      <motion.div className={styles.textbox}
        variants={textboxVariants} initial="initial" animate="enter" exit="exit"
        style={{ borderColor: themeColor }}
      >
        <div className={styles.speaker}>{currentLine?.speaker}</div>
        <div className={styles.text}>{displayedText}</div>
        <div className={styles.nextHint}>
          {isComplete ? (isLastLine ? '▶ 閉じる' : '▶ 次へ') : ''}
        </div>
      </motion.div>
    </motion.div>
  );
};
```

### BattleScreen からの呼び出し

```tsx
// BattleScreen.tsx（簡略）
const BattleScreen = () => {
  const [activeCG, setActiveCG] = useState<CGEvent | null>(null);

  const handleRoundResolve = (result: RoundResult) => {
    // ... ダメージ適用、ゲージ更新 ...

    if (result.cgEvent) {
      // CG 発動 → バトルUI を操作不可にしてカットイン表示
      setActiveCG(result.cgEvent);
    } else {
      proceedToNextRound();
    }
  };

  const handleCGClose = () => {
    setActiveCG(null);
    // CG 終了後に instantWin チェック
    const endResult = checkGameEnd();
    if (endResult) {
      showResult(endResult);
    } else {
      proceedToNextRound();
    }
  };

  return (
    <div className={styles.battleScreen}>
      {/* ... バトル UI ... */}

      <AnimatePresence>
        {activeCG && (
          <CGOverlay
            key={activeCG.id}
            cgEvent={activeCG}
            imageUrl={getCGImage(opponent.id, activeCG)}
            themeColor={opponent.theme.color}
            onClose={handleCGClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
```

### useTypewriter フック

```ts
interface UseTypewriterOptions {
  speed?: number;       // ms/文字（デフォルト: 30）
  startDelay?: number;  // 開始遅延（デフォルト: 0）
}

interface UseTypewriterReturn {
  displayedText: string;    // 現在表示されている部分テキスト
  isComplete: boolean;      // 全文表示済みか
  skipToEnd: () => void;    // 残りを即時表示
}

function useTypewriter(text: string, options?: UseTypewriterOptions): UseTypewriterReturn;
```

> テキストが変わるたび（dialogueIndex 更新時）に自動リセットされる。

### 不発時の演出

セクハラカード失敗時は CG カットインは発生しない。代わりに：

```
1. カード出す → 通常のカード解決アニメ
2. DialogueBox に失敗セリフ表示
   例:「は？何やってんだ？」「おいおい…シラフでそれかよ」
3. ドリンク等のダメージがあればそちらも処理
4. 次のラウンドへ
```

### ギャラリーからの再生

CGギャラリーでも同じ `CGOverlay` コンポーネントを再利用する。
バトル中とギャラリーで異なるのは `onClose` の行き先だけ。

```tsx
// GalleryScreen.tsx
<CGOverlay
  cgEvent={selectedCG}
  imageUrl={...}
  themeColor={...}
  onClose={() => setSelectedCG(null)}  // ギャラリーに戻る
/>
```

---

## アセット命名規則

```
assets/
├── characters/{characterId}/
│   ├── portrait.webp          # 立ち絵メイン
│   ├── portrait-drunk-{0-4}.webp  # 酔いレベル差分（将来）
│   ├── select-icon.webp       # 選択画面サムネ
│   └── cg/
│       └── {cgEvent.id の triggerCard 部分}.webp
│           例: shoulder.webp, headpat.webp, kiss.webp
│
├── cards/{cardId}.webp
│   例: beer.webp, wine.webp, whiskey.webp
│
├── ui/
│   ├── bg-title.webp
│   ├── bg-bar.webp
│   ├── bg-shop.webp
│   ├── card-back.webp
│   └── logo.webp
│
└── audio/
    ├── bgm-title.mp3
    ├── bgm-battle.mp3
    ├── bgm-shop.mp3
    ├── se-card-play.mp3
    ├── se-card-flip.mp3
    ├── se-drink.mp3
    ├── se-cg-flash.mp3
    └── se-result.mp3
```

### 画像参照パターン

```ts
// 静的 import（ビルド時にハッシュ付き URL へ変換される）
import blazePortrait from '@/assets/characters/blaze/portrait.webp';

// 動的 import（キャラ ID から動的に読み込む場合）
// Vite の import.meta.glob を使用
const characterPortraits = import.meta.glob<{ default: string }>(
  '@/assets/characters/*/portrait.webp',
  { eager: true }
);

// 使用例
function getPortrait(characterId: string): string {
  const key = `/src/assets/characters/${characterId}/portrait.webp`;
  return characterPortraits[key]?.default ?? '';
}
```

---

## 画像がまだない時の対応

開発初期は画像なしで進める。各コンポーネントにフォールバック表示を実装：

```tsx
// Card: 画像なし → 絵文字 + カラー背景
{imageUrl ? (
  <img src={imageUrl} alt={card.name} />
) : (
  <div className={styles.placeholder}>
    <span className={styles.emoji}>{card.emoji}</span>
  </div>
)}

// CharacterSprite: 画像なし → テーマカラー + アイコン
// CGOverlay: 画像なし → グラデーション背景（既存実装踏襲）
```

> 既存コードの CG は `cgColor` でグラデーション表示しているので、
> 画像追加は後からいつでも可能。

---

## データ保管

| データ | 保管先 | 方式 |
|--------|--------|------|
| マスターデータ | `src/data/*.ts` | TS ファイル直書き。`as const` で型推論 |
| ゲーム状態 | Zustand `useGameStore` | メモリ + `persist` → LocalStorage |
| バトル状態 | Zustand `useBattleStore` | メモリのみ（ページ閉じたらリセット） |
| ユーザー設定 | Zustand `useSettingsStore` | メモリ + `persist` → LocalStorage |

### LocalStorage キー

| キー | 内容 |
|------|------|
| `closures-bar-save` | ゲーム進行データ |
| `closures-bar-settings` | ユーザー設定 |

### 将来のオンライン化

```
Zustand persist middleware の storage アダプター差し替えだけで対応可能。
現在: localStorage adapter（デフォルト）
将来: Firebase / Supabase adapter に差し替え
```

---

## 開発順序（推奨）

```
Phase 1: 基盤構築
  ├── Vite + React + TS プロジェクト初期化
  ├── types/index.ts（型定義）
  ├── data/*.ts（マスターデータ移植）
  └── stores/*.ts（Zustand ストア）

Phase 2: エンジン移植
  ├── engine/utils.ts
  ├── engine/battle.ts
  └── engine/ai.ts

Phase 3: コンポーネント作成
  ├── Card, DrunkGauge, DialogueBox
  ├── CGOverlay, CharacterSprite, HandArea
  └── グローバル CSS

Phase 4: 画面作成
  ├── TitleScreen
  ├── SelectScreen
  ├── BattleScreen（メイン）
  ├── ShopScreen
  └── GalleryScreen

Phase 5: 演出・仕上げ
  ├── Framer Motion アニメーション
  ├── 画像・音声アセット追加
  └── レスポンシブ対応
```
