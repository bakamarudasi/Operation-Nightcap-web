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

---

#### TitleScreen — タイトル画面

バーの入口。ゲーム全体のハブ。暗めのバー背景にネオンロゴが映える。

```
┌───────────────────────────────────────────────────┐
│                                                   │
│              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               │  ← バー背景（暗い）
│              ▓  CLOSURE'S BAR    ▓               │  ← ネオン風ロゴ
│              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               │     text-shadow glow
│              ～今夜は帰さない～                    │  ← サブタイトル
│                                                   │
│              ┌──────────────────┐                  │
│              │  🍷 対戦する     │                  │  ← メインボタン(大)
│              └──────────────────┘                  │
│              ┌──────────────────┐                  │
│              │  🏪 ショップ     │                  │
│              └──────────────────┘                  │
│              ┌──────────────────┐                  │
│              │  🖼️ ギャラリー   │                  │
│              └──────────────────┘                  │
│              ┌──────────────────┐                  │
│              │  ⚙️ 設定         │                  │
│              └──────────────────┘                  │
│                                                   │
│              💰 3,200 龍門幣                       │  ← 所持金表示
│                                                   │
└───────────────────────────────────────────────────┘
```

**スタイル要点**:
- 背景: バーの暗い画像（`bg-title.webp`）+ 半透明オーバーレイ（黒60%）
- ロゴ: 大きめフォント、ネオンglow（`text-shadow` で多重発光）
- ボタン: 縦並び中央配置、ホバーで光る、`gap: 12px`
- 所持金: フッター寄り、控えめサイズ

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
      <button onClick={() => setScreen('gallery')}>🖼️ ギャラリー</button>
      <button onClick={() => setScreen('settings')}>⚙️ 設定</button>
      <div>💰 {money} 龍門幣</div>
    </div>
  );
};
```

---

#### SelectScreen — 対戦相手選択画面

キャラクターカード一覧。対戦相手を選んでバトルへ。

```
┌───────────────────────────────────────────────────┐
│ ← 戻る              対戦相手を選べ                │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  🔥         │  │  🧊         │  │  🔒       │ │
│  │             │  │             │  │           │ │
│  │  [立ち絵]   │  │  [立ち絵]   │  │   ???     │ │
│  │             │  │             │  │           │ │
│  │ ブレイズ     │  │  ???        │  │   ???     │ │
│  │ 燃え盛る太陽 │  │  未解放     │  │   未解放  │ │
│  │             │  │             │  │           │ │
│  │ 戦績: 5勝2敗│  │             │  │           │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                   │
│         ※ 未解放キャラは条件付きで開放             │
│                                                   │
└───────────────────────────────────────────────────┘
```

**カード構成**:
- サムネイル画像（`select-icon.webp`）
- テーマカラーの枠線 + glow
- キャラ名 + 称号
- 戦績表示（対戦済みキャラのみ）
- 未解放キャラ: シルエット + 🔒 + 解放条件ヒント

```tsx
// screens/SelectScreen/SelectScreen.tsx
export const SelectScreen = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const setOpponent = useGameStore((s) => s.setCurrentOpponent);
  const encountered = useGameStore((s) => s.encounteredCharacters);

  const handleSelect = (characterId: CharacterId) => {
    setOpponent(characterId);
    setScreen('battle');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setScreen('title')}>← 戻る</button>
        <h2>対戦相手を選べ</h2>
      </div>
      <div className={styles.characterGrid}>
        {Object.values(CHARACTER_DATA).map(c => {
          const unlocked = true; // 初期キャラは最初から解放。追加キャラは条件付き
          return (
            <motion.button
              key={c.id}
              className={clsx(styles.charCard, { [styles.locked]: !unlocked })}
              style={{ borderColor: c.theme.color, boxShadow: `0 0 12px ${c.theme.colorGlow}` }}
              onClick={() => unlocked && handleSelect(c.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              disabled={!unlocked}
            >
              <div className={styles.icon}>{c.theme.icon}</div>
              <div className={styles.portrait}>
                {/* select-icon.webp or fallback */}
              </div>
              <h3>{unlocked ? c.name : '???'}</h3>
              <p className={styles.subtitle}>{unlocked ? c.subtitle : '未解放'}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
```

---

#### BattleScreen — バトル画面

ゲームの核心。上に相手、下に自分、中央にカード場。

```
┌───────────────────────────────────────────────────┐
│ CLOSURE'S BAR              R.3/12     💰 3,200    │ ← ヘッダー
├───────────────────────────────────────────────────┤
│                                                   │
│   [相手の酔い] ██████░░░░ Lv.2 酔い (5/10)        │ ← 相手DrunkGauge
│                                                   │
│          ┌──────────┐                              │
│          │          │                              │
│          │ 相手立ち絵 │  ← CharacterSprite          │
│          │ (酔い演出) │     酔いLvで表情・揺れ変化   │
│          │          │                              │
│          └──────────┘                              │
│          「おい…暑くないか…？」                     │ ← DialogueBox
│                                                   │
│       ┌──────┐   VS   ┌──────┐                    │ ← テーブル（カード場）
│       │相手の │        │自分の │                    │
│       │カード │        │カード │                    │
│       │  ？   │        │  ？   │                    │
│       └──────┘        └──────┘                    │
│                                                   │
│   [自分の酔い] ████░░░░░░ Lv.1 ほろ酔い (3/10)    │ ← 自分DrunkGauge
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │ ← 手札エリア
│   │🍺    │ │🍷    │ │🥜    │ │💋    │  残デッキ:8 │
│   │ビール │ │ワイン │ │ナッツ │ │キス  │            │
│   │ Dmg:1│ │ Dmg:2│ │Heal:1│ │条件:3│            │
│   └──────┘ └──────┘ └──────┘ └──────┘            │
│              ↑ 選択中（光る）                      │
│                                                   │
└───────────────────────────────────────────────────┘
```

**レイアウト構成**:
- ヘッダー: バー名、ラウンド数、所持金
- 上部: 相手のDrunkGauge
- 中央上: 相手の立ち絵（CharacterSprite）+ セリフ（DialogueBox）
- 中央: テーブルエリア（場に出したカード2枚 + VS表示）
- 中央下: 自分のDrunkGauge
- 下部: 手札エリア（4枚 + 残りデッキ数）

**操作フロー**:
1. 手札からカードをクリック → 選択状態（浮き上がる）
2. もう一度クリック or 確認ボタン → カード場に出す
3. 相手AIもカード選択 → 同時オープン
4. 効果解決アニメーション → ゲージ更新

```tsx
// screens/BattleScreen/BattleScreen.tsx
export const BattleScreen = () => {
  const battle = useBattleStore();
  const gameStore = useGameStore();
  const opponent = CHARACTER_DATA[gameStore.currentOpponent!];

  return (
    <div className={styles.container}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <span>CLOSURE'S BAR</span>
        <span>R.{battle.round}/{battle.maxRounds}</span>
        <span>💰 {gameStore.money}</span>
      </div>

      {/* 相手エリア */}
      <DrunkGauge value={battle.opponentDrunk} max={opponent.drunkMax} side="opponent" />
      <CharacterSprite
        characterId={opponent.id}
        drunkLevel={getDrunkLevel(battle.opponentDrunk)}
      />
      <DialogueBox speaker={opponent.name} text={currentDialogue} />

      {/* テーブル */}
      <div className={styles.table}>
        <Card card={battle.opponentPlayedCard} faceDown={!battle.isRevealed} />
        <span className={styles.vs}>VS</span>
        <Card card={battle.playerPlayedCard} faceDown={!battle.isRevealed} />
      </div>

      {/* 自分エリア */}
      <DrunkGauge value={battle.playerDrunk} max={10} side="player" />

      {/* 手札 */}
      <HandArea
        cards={battle.playerHand}
        selectedIndex={battle.selectedCard}
        onSelect={(i) => battle.selectCard(i)}
        disabled={battle.isProcessing}
      />
      <span>残デッキ: {battle.playerDeckRemaining.length}枚</span>

      {/* 結果モーダル */}
      {battle.gameEnd && (
        <ResultModal
          result={battle.gameEnd}
          reward={battle.reward}
          onBack={() => gameStore.setScreen('title')}
        />
      )}

      {/* CG オーバーレイ */}
      {battle.activeCG && (
        <CGOverlay
          cgEvent={battle.activeCG}
          themeColor={opponent.theme.color}
          onClose={() => battle.clearCG()}
        />
      )}
    </div>
  );
};
```

**バトル結果モーダル**:

```
┌───────────────────────────────────┐
│                                   │
│           🎉 勝 利 🎉            │
│                                   │
│    ブレイズを酔い潰した！          │
│                                   │
│    💰 +500 龍門幣                 │
│                                   │
│    ┌─────────────────────────┐    │
│    │     バーに戻る           │    │
│    └─────────────────────────┘    │
│                                   │
└───────────────────────────────────┘
```

---

#### ShopScreen — ショップ画面

クロージャが店番をするカード売買 & デッキ編集画面。

```
┌───────────────────────────────────────────────────┐
│ ← 戻る    🏪 CLOSURE'S BAR SHOP    💰 3,200 龍門幣│
├───────────────────────────────────────────────────┤
│                                                   │
│  🐧「いらっしゃい。今日は何にする？」              │ ← クロージャのセリフ
│                                                   │
├────────────── 販売カード ─────────────────────────┤
│                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │🍺    │ │🍷    │ │🥃    │ │🍶    │ │🍹    │   │  ← ドリンク
│  │ビール │ │ワイン │ │ｳｲｽｷｰ│ │ 白酒 │ │ｶｸﾃﾙ │   │
│  │ 100龍 │ │ 300龍 │ │ 500龍│ │ 800龍│ │ 400龍│   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │🥜    │ │🍢    │ │🍜    │ │💊    │             │  ← フード
│  │ナッツ │ │焼き鳥│ │ラーメン│ │ウコン │             │
│  │ 100龍 │ │ 300龍 │ │ 600龍│ │1200龍│             │
│  └──────┘ └──────┘ └──────┘ └──────┘             │
│  ┌──────┐ ┌──────┐ ┌──────┐                      │
│  │🍻    │ │🥂    │ │💧    │                      │  ← 特殊
│  │一気飲み│ │乾杯  │ │こぼし │                      │
│  │ 800龍 │ │ 700龍 │ │ 500龍│                      │
│  └──────┘ └──────┘ └──────┘                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │💕    │ │✋    │ │👀    │ │🛌    │ │💋    │   │  ← セクハラ
│  │肩寄せ │ │ﾎﾟﾝﾎﾟﾝ │ │見つめ│ │膝枕  │ │キス  │   │
│  │1500龍 │ │1500龍 │ │1500龍│ │2000龍│ │3000龍│   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│                                                   │
├──────────── 現在のデッキ (12/12) ─────────────────┤
│                                                   │
│  🍺🍺🍺🍺 🍷🍷 🥃 🥜🥜🥜 🍢 🍻                  │  ← デッキ表示
│                                                   │
│  ※ カードをクリックで売却（半額買取）               │
│                                                   │
└───────────────────────────────────────────────────┘
```

**レイアウト構成**:
- ヘッダー: 戻るボタン、ショップ名、所持金
- クロージャセリフ: 操作に応じて変化するNPCセリフ欄
- 販売エリア: カード種別ごとにグリッド配置（購入価格表示付き）
- デッキエリア: 現在のデッキ構成を表示（クリックで売却）

**購入操作**:
1. カードをクリック → 購入確認
2. 所持金足りない → クロージャ「お金が足りないよ」
3. デッキ満杯 → クロージャ「デッキがいっぱいだよ。先に売ってね」
4. 購入成功 → デッキに追加 + 所持金減算 + クロージャセリフ変化

**売却操作**:
1. デッキエリアのカードをクリック → 売却確認
2. 売却 → デッキから除外 + 所持金加算（購入の50%）

```tsx
// screens/ShopScreen/ShopScreen.tsx
export const ShopScreen = () => {
  const { money, playerDeck, setScreen } = useGameStore();
  const [closureDialogue, setClosureDialogue] = useState(
    randomPick(SHOP_DATA.closureLines.greeting)
  );

  const handleBuy = (cardId: CardId) => {
    const card = CARD_DATA[cardId];
    if (money < card.price) {
      setClosureDialogue(randomPick(SHOP_DATA.closureLines.insufficient));
      return;
    }
    if (playerDeck.length >= 12) {
      setClosureDialogue(randomPick(SHOP_DATA.closureLines.deckFull));
      return;
    }
    useGameStore.getState().buyCard(cardId);
    setClosureDialogue(randomPick(SHOP_DATA.closureLines[getShopLineCategory(card.type)]));
  };

  const handleSell = (index: number) => {
    useGameStore.getState().sellCard(index);
    setClosureDialogue(randomPick(SHOP_DATA.closureLines.sell));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setScreen('title')}>← 戻る</button>
        <h2>🏪 CLOSURE'S BAR SHOP</h2>
        <span>💰 {money} 龍門幣</span>
      </div>

      <div className={styles.closureDialogue}>
        🐧「{closureDialogue}」
      </div>

      {/* 販売カード（種別ごとにセクション分け） */}
      <div className={styles.shopGrid}>
        {(['drink', 'food', 'chug', 'harassment'] as CardType[]).map(type => (
          <div key={type} className={styles.shopSection}>
            {SHOP_DATA.availableCards
              .filter(id => CARD_DATA[id].type === type)
              .map(id => (
                <ShopCard
                  key={id}
                  card={CARD_DATA[id]}
                  onBuy={() => handleBuy(id)}
                  affordable={money >= CARD_DATA[id].price}
                />
              ))}
          </div>
        ))}
      </div>

      {/* デッキ表示 */}
      <div className={styles.deckEditor}>
        <h3>現在のデッキ ({playerDeck.length}/12)</h3>
        <div className={styles.deckDisplay}>
          {playerDeck.map((cardId, i) => (
            <Card
              key={i}
              card={CARD_DATA[cardId]}
              onClick={() => handleSell(i)}
              compact
            />
          ))}
        </div>
      </div>
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
  ┌────┴──────┬──────────┬──────────┐
  ▼           ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌────────┐  ┌──────────┐
│Select│  │ Shop │  │Gallery │  │ Settings │
└──┬───┘  └──────┘  │ [CG]   │  └──────────┘
   │                │[立ち絵] │
   ▼                └────────┘
┌──────┐
│Battle│→勝敗結果→Titleへ
└──────┘
```

> Gallery 画面内でタブ切替（CG / 立ち絵）。独立画面にはしない。

```tsx
// App.tsx
export const App = () => {
  const screen = useGameStore((s) => s.currentScreen);

  return (
    <AnimatePresence mode="wait">
      {screen === 'title'    && <TitleScreen    key="title" />}
      {screen === 'select'   && <SelectScreen   key="select" />}
      {screen === 'battle'   && <BattleScreen   key="battle" />}
      {screen === 'shop'     && <ShopScreen     key="shop" />}
      {screen === 'gallery'  && <GalleryScreen  key="gallery" />}
      {screen === 'settings' && <SettingsScreen key="settings" />}
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

## スケベ演出仕様

このゲームの核心。酔いが深まるほどキャラの反応が変わり、
CG が解放され、プレイヤーの「もっと酔わせたい」欲求を掻き立てる設計。

### 1. CG 段階システム

同じセクハラカードでも、**相手の酔いレベルによって CG の内容が変わる**。
酔いが深いほどきわどいリアクションになる。

```
肩を寄せる（shoulder_lean）:
  酔Lv1（条件ギリギリ）→ CG-A: 驚いてちょっと離れる（照れ）
  酔Lv2（余裕あり）    → CG-B: 肩に寄りかかってくる
  酔Lv3（べろべろ）    → CG-C: そのまま腕を組んでくる

頭ポンポン（headpat）:
  酔Lv2（条件ギリギリ）→ CG-A: 「子ども扱いすんな」と怒るが耳赤い
  酔Lv3（べろべろ）    → CG-B: 目を閉じて受け入れる、甘え声

見つめる（gaze）:
  酔Lv2（条件ギリギリ）→ CG-A: 目をそらす、動揺
  酔Lv3（べろべろ）    → CG-B: 見つめ返してくる、トロン目

膝枕する（lap_pillow）:
  酔Lv3（条件ギリギリ）→ CG-A: 恥ずかしがりながら乗る
  ※段階1つのみ（条件Lv3なので上はない）

キス（kiss）:
  酔Lv3（条件ギリギリ）→ CG-A: 即勝利。最高潮のCG
  ※段階1つのみ（即勝利なのでこれが最終到達点）
```

#### 型定義の拡張

```ts
export interface CGEvent {
  id: string;
  triggerCard: CardId;
  requiredDrunkLevel: number;
  cgColor: string;
  instantWin?: boolean;
  dialogue: DialogueLine[];
  // ▼ 追加: 段階CG
  variants?: CGVariant[];
}

export interface CGVariant {
  /** この段階が発動する酔いLv（requiredDrunkLevel より高い） */
  drunkLevel: number;
  /** この段階のCG ID（ギャラリー管理用） */
  cgId: string;
  /** 差し替えるダイアログ */
  dialogue: DialogueLine[];
  /** 差し替えるCGカラー（画像なし時用） */
  cgColor?: string;
}
```

#### 解決ロジック

```ts
function resolveCGEvent(cgEvent: CGEvent, currentDrunkLevel: number): {
  cgId: string;
  dialogue: DialogueLine[];
  cgColor: string;
} {
  // variants が定義されていれば、酔いLvの高い方から条件チェック
  if (cgEvent.variants) {
    const matched = cgEvent.variants
      .filter(v => currentDrunkLevel >= v.drunkLevel)
      .sort((a, b) => b.drunkLevel - a.drunkLevel)[0];
    if (matched) {
      return {
        cgId: matched.cgId,
        dialogue: matched.dialogue,
        cgColor: matched.cgColor ?? cgEvent.cgColor,
      };
    }
  }
  // デフォルト（基本CG）
  return {
    cgId: cgEvent.id,
    dialogue: cgEvent.dialogue,
    cgColor: cgEvent.cgColor,
  };
}
```

> **ギャラリーへの影響**: 各 variant の cgId も個別に `unlockedCGs` に記録される。
> 同じカードでも酔いLv違いで別CGとしてギャラリーに並ぶ。

### 2. キャラ反応のセリフ分岐

セクハラカード以外でも、**酔いレベルに応じてバトル中のセリフが変化**する。

#### 酔いLv × 状況 のセリフマトリクス

```
              酔Lv0(シラフ)    酔Lv1(ほろ酔い)   酔Lv2(酔い)      酔Lv3(べろべろ)
─────────────────────────────────────────────────────────────────────────────────
ドリンク受け  「くっ…効くな」   「うぅ…まだいけ  「あつい…暑い    「もう…やだ…
              (強気)           る…」(意地)      よぉ…」(弱気)    ドクターのばか…」

つまみ食べ    「うまそうな      「ん〜美味い♪」  「ドクター…      「あーん…して
              もん食ってんな」  (ご機嫌)          食べさせて？」   …？」(甘え)
              (普通)                              (おねだり)

ラウンド開始  「さぁ来い！」    「へへ…次は       「ねぇ…もう     「…zzZ…えっ
              (挑発)            負けないぞ」      やめない…？」    まだやるの…？」
                               (絡み)            (甘え)           (うとうと)
```

#### 型定義

```ts
export interface Character {
  // ... 既存フィールド ...
  battleLines: {
    // 既存（酔いLv不問の汎用セリフ）
    playDrink: string[];
    playFood: string[];
    // ...

    // ▼ 追加: 酔いLv別セリフ（オプショナル。未定義なら汎用を使う）
    drunkLines?: {
      [level in DrunkLevelValue]?: {
        takeDamage?: string[];
        eatFood?: string[];
        roundStart?: string[];
        idle?: string[];          // 何もしない時間のつぶやき
      };
    };
  };
}
```

#### セリフ取得ロジック

```ts
function getBattleLine(
  character: Character,
  situation: 'takeDamage' | 'eatFood' | 'roundStart' | 'idle',
  drunkLevel: DrunkLevelValue
): string {
  // 酔いLv別セリフが定義されていればそちらを優先
  const drunkLines = character.battleLines.drunkLines?.[drunkLevel]?.[situation];
  if (drunkLines && drunkLines.length > 0) {
    return randomPick(drunkLines);
  }
  // フォールバック: 汎用セリフ
  const fallbackMap = {
    takeDamage: character.battleLines.takeDamage,
    eatFood: character.battleLines.playFood,
    roundStart: character.battleLines.playDrink,
    idle: character.drunkLevels.find(l => l.level === drunkLevel)?.lines ?? [],
  };
  return randomPick(fallbackMap[situation]) ?? '';
}
```

### 3. 隠し CG / ご褒美 CG

通常のセクハラカードでは解放されない**特殊条件CG**。
ギャラリーでは「???」で表示され、コンプリート欲を刺激する。

#### 隠しCG一覧（ブレイズの例）

| CG ID | 解放条件 | 内容 |
|-------|---------|------|
| `blaze_perfect` | ブレイズに酔いLv0（ノーダメ）で勝利 | 「…っ、あたしの負けだよ。強いな、ドクター」悔しそうだけど尊敬の目 |
| `blaze_drunk_together` | 自分もLv3以上でブレイズに勝利 | 二人とも酔っ払って寄りかかってるCG。「…ドクターも弱いくせに」 |
| `blaze_all_cg` | ブレイズの通常CG全解放 | ご褒美CG。「…あんたにはかなわないな。全部見られちゃったじゃん…」 |
| `blaze_loss_3` | ブレイズに3回負ける | 「おいおい大丈夫かよ…ほら水飲め」世話焼きCG |

#### 型定義

```ts
export interface HiddenCG {
  id: string;
  characterId: CharacterId;
  /** 解放条件の判定関数名（engine/rewards.ts で定義） */
  condition: HiddenCGCondition;
  /** ギャラリーでのヒントテキスト（未解放時に表示） */
  hint: string;
  /** CG内容 */
  cgColor: string;
  dialogue: DialogueLine[];
}

export type HiddenCGCondition =
  | { type: 'perfect_win'; characterId: CharacterId }
  | { type: 'drunk_win'; characterId: CharacterId; minPlayerDrunk: number }
  | { type: 'all_cg_unlocked'; characterId: CharacterId }
  | { type: 'loss_count'; characterId: CharacterId; count: number };
```

#### 解放チェック（バトル結果時に実行）

```ts
// engine/rewards.ts
function checkHiddenCGs(
  result: GameEndResult,
  character: Character,
  playerDrunk: number,
  gameStore: GameStore
): HiddenCG[] {
  const unlocked: HiddenCG[] = [];

  for (const hcg of HIDDEN_CG_DATA[character.id] ?? []) {
    if (gameStore.isCGUnlocked(hcg.id)) continue; // 既に解放済み

    const met = evaluateCondition(hcg.condition, {
      result, character, playerDrunk, gameStore
    });

    if (met) {
      unlocked.push(hcg);
      gameStore.unlockCG(hcg.id);
    }
  }
  return unlocked;
}
```

#### ギャラリーでの表示

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ 肩  │ │ 頭  │ │ 見  │ │ 膝  │ │ キス│  ← 通常CG（解放済みは画像表示）
│寄せる│ │ポンポン│ │つめる│ │ 枕 │ │     │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ ???  │ │ ???  │ │ ???  │ │ ???  │  ← 隠しCG（未解放は「???」+ ヒント）
│ヒント│ │ヒント│ │ヒント│ │ヒント│     「ノーダメで勝利すると…？」
└─────┘ └─────┘ └─────┘ └─────┘
```

### 4. 酔い演出の視覚変化

酔いレベルが上がるほど、立ち絵やUI全体に視覚変化を加える。

#### 立ち絵の段階変化

```
酔Lv0 (シラフ):
  - 通常立ち絵
  - 表情: 自信満々

酔Lv1 (ほろ酔い):
  - 頬に赤み（CSSフィルタ: hue-rotate + overlay）
  - 微笑み表情差分
  - 立ち絵がわずかに揺れる（Framer Motion: x ±2px, 2s周期）

酔Lv2 (酔い):
  - 頬の赤みが強まる
  - 目がトロンとする表情差分
  - 揺れが大きくなる（x ±5px, 1.5s周期）
  - 服の乱れ差分（ボタン1つ外れる等）

酔Lv3 (べろべろ):
  - 顔全体が赤い
  - 目がトロトロ、口が半開き
  - 大きく揺れる（x ±8px, 1s周期 + rotate ±3deg）
  - 服がさらに乱れる
  - セリフが甘え声（テキストにハートマーク混じる）

酔Lv4 (潰れ):
  - 目を閉じている
  - 体が傾いている（rotate 5deg）
  - 立ち絵が下にずれる（寝落ち演出）
```

#### CharacterSprite の酔い演出実装

```tsx
const drunkEffects: Record<DrunkLevelValue, {
  sway: { x: number; duration: number };
  rotate: number;
  filter: string;
  translateY: number;
}> = {
  0: { sway: { x: 0,  duration: 0 },   rotate: 0,  filter: 'none',                          translateY: 0 },
  1: { sway: { x: 2,  duration: 2 },   rotate: 0,  filter: 'saturate(1.1)',                  translateY: 0 },
  2: { sway: { x: 5,  duration: 1.5 }, rotate: 0,  filter: 'saturate(1.2) brightness(1.05)', translateY: 0 },
  3: { sway: { x: 8,  duration: 1 },   rotate: 3,  filter: 'saturate(1.4) brightness(1.1)',  translateY: 0 },
  4: { sway: { x: 3,  duration: 2.5 }, rotate: 5,  filter: 'saturate(1.3) brightness(1.0)',  translateY: 20 },
};

export const CharacterSprite = ({ characterId, imageUrl, drunkLevel }: CharacterSpriteProps) => {
  const effect = drunkEffects[drunkLevel];

  return (
    <motion.div
      className={styles.sprite}
      animate={{
        x: effect.sway.x > 0
          ? [0, effect.sway.x, 0, -effect.sway.x, 0]
          : 0,
        rotate: effect.rotate,
        y: effect.translateY,
      }}
      transition={{
        x: { repeat: Infinity, duration: effect.sway.duration, ease: 'easeInOut' },
        rotate: { type: 'spring', stiffness: 50 },
        y: { type: 'spring', stiffness: 80 },
      }}
      style={{ filter: effect.filter }}
    >
      {/* 頬の赤み（CSS overlay） */}
      {drunkLevel >= 1 && (
        <div
          className={styles.blush}
          style={{ opacity: drunkLevel * 0.15 }}
        />
      )}

      {imageUrl ? (
        <img src={imageUrl} alt={characterId} />
      ) : (
        <div className={styles.placeholder}>
          {CHARACTER_DATA[characterId]?.theme.icon}
        </div>
      )}
    </motion.div>
  );
};
```

#### 頬赤み CSS

```css
/* CharacterSprite.module.css */
.blush {
  position: absolute;
  top: 30%;
  left: 15%;
  right: 15%;
  height: 20%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 100, 100, 0.5) 0%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 2;
}
```

#### 画像差分の管理（将来用）

```
assets/characters/blaze/
├── portrait.webp              # Lv0: 通常
├── portrait-drunk-1.webp      # Lv1: ほろ酔い（微笑み、頬赤い）
├── portrait-drunk-2.webp      # Lv2: 酔い（トロン目、服乱れ）
├── portrait-drunk-3.webp      # Lv3: べろべろ（甘え顔、服大乱れ）
└── portrait-drunk-4.webp      # Lv4: 潰れ（目閉じ、傾き）
```

```ts
// 差分画像の動的読み込み
const portraits = import.meta.glob<{ default: string }>(
  '@/assets/characters/*/portrait*.webp',
  { eager: true }
);

function getPortrait(characterId: string, drunkLevel: DrunkLevelValue): string {
  if (drunkLevel === 0) {
    const key = `/src/assets/characters/${characterId}/portrait.webp`;
    return portraits[key]?.default ?? '';
  }
  // 酔い差分があればそれを使う、なければ通常
  const drunkKey = `/src/assets/characters/${characterId}/portrait-drunk-${drunkLevel}.webp`;
  const baseKey = `/src/assets/characters/${characterId}/portrait.webp`;
  return portraits[drunkKey]?.default ?? portraits[baseKey]?.default ?? '';
}
```

> **画像差分がない時**: CSSフィルタ + 赤みオーバーレイ + 揺れアニメで代用。
> 画像が追加されたら自動で差し替わる設計。

### スケベ要素まとめ

```
酔わせる楽しさのループ:

  酔いLv上がる → 立ち絵が赤面・揺れ・服乱れ（視覚報酬）
       ↓
  セリフが甘くなる（テキスト報酬）
       ↓
  セクハラカード使える → CG解放（最大報酬）
       ↓
  同じカードでも酔いLv高いと別CG（もっと酔わせたい欲）
       ↓
  隠しCGの存在がギャラリーで見える（コンプリート欲）
       ↓
  もう1回プレイしよう！
```

---

## 報酬・経済バランス

### 初期所持金

```
初期龍門幣: 3200
```

### バトル報酬

| 結果 | 報酬 | 備考 |
|------|------|------|
| 勝利 | +500 龍門幣 | 安定収入 |
| 勝利（酔いLv0クリア） | +800 龍門幣 | ノーダメボーナス |
| 敗北 | +100 龍門幣 | 負けても少しもらえる（救済） |
| 引き分け | +200 龍門幣 | |

> 勝利時ボーナスの追加枠（将来拡張）：
> - 特定ラウンド数以内クリア
> - CG 全回収クリア

### カード価格と売却

| カード | 購入価格 | 売却価格 | 売却率 |
|--------|---------|---------|--------|
| ビール | 100 | 50 | 50% |
| ワイン | 300 | 150 | 50% |
| ウイスキー | 500 | 250 | 50% |
| 白酒 | 800 | 400 | 50% |
| カクテル | 400 | 200 | 50% |
| ナッツ | 100 | 50 | 50% |
| 焼き鳥 | 300 | 150 | 50% |
| ラーメン | 600 | 300 | 50% |
| ウコン | 1200 | 600 | 50% |
| 一気飲み | 800 | 400 | 50% |
| 乾杯強制 | 700 | 350 | 50% |
| こぼし | 500 | 250 | 50% |
| 肩を寄せる | 1500 | 750 | 50% |
| 頭ポンポン | 1500 | 750 | 50% |
| 見つめる | 2000 | 1000 | 50% |
| 膝枕する | 3000 | 1500 | 50% |
| キス | 5000 | 2500 | 50% |

**売却価格 = 購入価格の50%（一律）**。クロージャのセリフ通り。

### 経済サイクル設計

```
1試合の期待収入: 約 500 龍門幣（勝率50%想定で平均 300）

★カード     100~400     → 1~2試合で買える（気軽に試せる）
★★カード   300~800     → 2~3試合で買える
★★★カード 500~1200    → 3~5試合で買える
★★★★カード 1500~3000  → 5~10試合（CG報酬としての達成感）
★★★★★★   5000        → 10試合以上（最終目標）

初期資金 3200 で最初のセクハラカード（1500）が2枚買える
→ 序盤から CG 体験可能な設計
```

---

## デッキ編集ルール

### 基本制約

| ルール | 値 | 理由 |
|--------|-----|------|
| デッキ枚数 | **ちょうど12枚** | 12ラウンドとの対応。過不足なし |
| 同名カード上限 | **4枚まで** | ビール4枚のようなゴリ押しは可能だが偏る |
| カード種別制約 | なし | ドリンク12枚でもつまみ12枚でもOK |
| 最低1種別制約 | なし | 自由に組ませる（自己責任） |

### ショップでの操作

```
購入フロー:
  1. ショップでカードを選ぶ
  2. デッキが12枚未満 → そのまま追加
  3. デッキが12枚     → 「デッキが満杯です。先に1枚売却してください」

売却フロー:
  1. 所持デッキ一覧からカードを選ぶ
  2. 「売却する？（購入価格の50%で買い取り）」確認
  3. 売却 → デッキから除外 + 龍門幣加算
  4. デッキ11枚以下になる → 購入可能に

入れ替えフロー（購入+売却の組み合わせ）:
  デッキ満杯時に購入したい
  → 先に売却して空きを作る → 購入
  （一括入れ替えUIは将来拡張）
```

### 初期デッキ

```ts
const DEFAULT_DECK: CardId[] = [
  'beer', 'beer', 'beer', 'beer',   // ★×4  基本攻撃
  'wine', 'wine',                     // ★★×2 中攻撃
  'nuts', 'nuts', 'nuts',             // ★×3  基本回復
  'yakitori',                         // ★★×1 中回復
  'whiskey',                          // ★★★×1 重い一撃
  'chug',                             // ★★★×1 ハイリスク
];
// 合計12枚。バランス型。セクハラカードなし（ショップで買う楽しみ）
```

### デッキ枚数と同名上限の型

```ts
// data/rules.ts
export const DECK_RULES = {
  deckSize: 12,           // ちょうど12枚
  maxCopies: 4,           // 同名カード上限
  sellRate: 0.5,          // 売却率（50%）
} as const;
```

---

## 音声・BGM 仕様

### BGM 一覧

| ID | ファイル | 再生画面 | ループ | 雰囲気 |
|----|---------|---------|--------|--------|
| `bgm-title` | bgm-title.mp3 | タイトル | ループ | ジャズ風、バーの雰囲気 |
| `bgm-battle` | bgm-battle.mp3 | バトル | ループ | テンポ良い、緊張感 |
| `bgm-shop` | bgm-shop.mp3 | ショップ | ループ | のんびり、クロージャの店 |
| `bgm-gallery` | bgm-gallery.mp3 | ギャラリー | ループ | 穏やか、回想 |
| `bgm-cg` | bgm-cg.mp3 | CGカットイン | ループ | ロマンチック、ドキドキ |

### SE 一覧

| ID | ファイル | トリガー | 備考 |
|----|---------|---------|------|
| `se-card-play` | se-card-play.mp3 | カードを出した瞬間 | 「パシッ」 |
| `se-card-flip` | se-card-flip.mp3 | 相手カードめくり | 「ペラッ」 |
| `se-drink` | se-drink.mp3 | ドリンクダメージ発生時 | 「ゴクゴク」 |
| `se-food` | se-food.mp3 | つまみ回復時 | 「モグモグ」 |
| `se-chug` | se-chug.mp3 | 一気飲みカード発動 | 「ドンッ！」 |
| `se-cg-flash` | se-cg-flash.mp3 | CGカットイン開始 | 「キラーン」白フラッシュと同時 |
| `se-result-win` | se-result-win.mp3 | 勝利時 | ファンファーレ |
| `se-result-lose` | se-result-lose.mp3 | 敗北時 | しょんぼり |
| `se-buy` | se-buy.mp3 | ショップ購入時 | 「チャリン」 |
| `se-sell` | se-sell.mp3 | ショップ売却時 | 「チャリン（低め）」 |
| `se-gauge-up` | se-gauge-up.mp3 | 酔いゲージ上昇アニメ | 「ブクブク」 |

### BGM 切り替えルール

```
画面遷移時:
  前のBGM → 0.5s フェードアウト → 0.3s 無音 → 新BGM フェードイン 0.5s

CGカットイン時:
  バトルBGM → 0.3s フェードアウト → CG用BGM フェードイン
  CG終了時  → CG用BGM フェードアウト → バトルBGM 再開（途中から）

同じBGMの画面間移動:
  切り替えない（例: タイトル→タイトルに戻る場合は再生続行）
```

### 音量制御

```ts
// useSettingsStore に追加
interface SettingsStore {
  bgmVolume: number;    // 0.0 ~ 1.0（デフォルト: 0.5）
  seVolume: number;     // 0.0 ~ 1.0（デフォルト: 0.7）
  // ...
}
```

> BGM は控えめデフォルト（0.5）。飲み会で周りの声が聞こえるように。
> SE はやや大きめデフォルト（0.7）。カード演出の気持ちよさ重視。

### 音声管理フック

```ts
// hooks/useAudio.ts
interface UseAudioReturn {
  playBGM: (id: BgmId) => void;
  stopBGM: (fadeOut?: number) => void;
  playSE: (id: SeId) => void;
}

function useAudio(): UseAudioReturn;
```

> 内部で `HTMLAudioElement` を使用。
> BGM は1トラック（排他再生）。SE は複数同時再生可。

### 音声がない時の対応

開発初期は音声ファイルなしで進める。`useAudio` 内でファイルが
見つからない場合は警告なしでスキップ（エラーにしない）。

```ts
const playBGM = (id: BgmId) => {
  const src = BGM_FILES[id];
  if (!src) return;  // ファイルなし → 何もしない
  // ...
};
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

### 操作方式: クリック/タップのみ

CG 中の操作は **画面どこでもクリック/タップ** の1操作のみ。
ボタンなし、スワイプなし。酔ってても迷わない。

```
ユーザー操作          → 結果
──────────────────────────────────────
タップ（タイプ中）    → 全文を即表示
タップ（表示済み）    → 次のセリフへ
タップ（最後のセリフ）→ カットイン終了、バトルに戻る
```

> 「戻る」機能なし。見逃したらギャラリーで再閲覧。
> AUTO モードなし。将来追加する場合は `useSettingsStore` に `autoPlay: boolean` を足すだけ。

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

  ↓        ⑤ タップ: タイプ途中 → 全文即表示
  ↓        ⑥ タップ: 表示済み → 次のセリフ（④に戻る）
  ↓        ⑦ タップ: 最後のセリフ → 閉じる
           　 CG画像がフェードアウト + スケールダウン
           　 暗転解除 → バトル画面に復帰
```

> ① の演出中はタップ無視（誤タップ防止のため 700ms のガード時間）。

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

## 設定画面（SettingsScreen）

タイトル画面から「⚙️ 設定」で遷移。音量・テキスト速度などの基本設定。

### レイアウト

```
┌─────────────────────────────────────────────┐
│ ← 戻る          ⚙️ 設 定                    │
├─────────────────────────────────────────────┤
│                                             │
│  🔊 BGM 音量   ──●──────────── 80%          │
│                                             │
│  🔉 SE 音量    ──────●──────── 60%          │
│                                             │
│  💬 テキスト速度 ────●─────── ふつう         │
│     （はやい ← → おそい）                    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  🗑️ データリセット                           │
│  （確認ダイアログ付き）                       │
│                                             │
└─────────────────────────────────────────────┘
```

### 型定義の拡張

```ts
// useGameStore の currentScreen に追加
type ScreenId =
  | 'title' | 'select' | 'battle' | 'shop' | 'gallery'
  | 'settings';     // ← 追加
```

### SettingsScreen コンポーネント

```tsx
export const SettingsScreen = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const { bgmVolume, seVolume, textSpeed, setBgmVolume, setSeVolume, setTextSpeed } =
    useSettingsStore();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setScreen('title')}>← 戻る</button>
        <h2>⚙️ 設定</h2>
      </div>

      <div className={styles.section}>
        <label>🔊 BGM 音量</label>
        <input type="range" min={0} max={1} step={0.05}
               value={bgmVolume} onChange={e => setBgmVolume(+e.target.value)} />

        <label>🔉 SE 音量</label>
        <input type="range" min={0} max={1} step={0.05}
               value={seVolume} onChange={e => setSeVolume(+e.target.value)} />

        <label>💬 テキスト速度</label>
        <input type="range" min={10} max={80} step={5}
               value={textSpeed} onChange={e => setTextSpeed(+e.target.value)} />
        <span>{textSpeed <= 20 ? 'はやい' : textSpeed <= 40 ? 'ふつう' : 'おそい'}</span>
      </div>

      <div className={styles.section}>
        <button className={styles.dangerBtn} onClick={handleReset}>
          🗑️ データリセット
        </button>
      </div>
    </div>
  );
};
```

---

## ギャラリー画面 タブ構成（GalleryScreen）

GalleryScreen は **タブ切替** で2つのモードを持つ。
タイトル画面のメニューボタンは「🖼️ ギャラリー」（旧「CGギャラリー」）に変更。

### タブ

| タブ | 内容 |
|------|------|
| 🖼️ CG | 従来のCGギャラリー。解放済みCGをサムネ一覧表示、クリックで再生 |
| 👗 立ち絵 | 立ち絵鑑賞モード。キャラの立ち絵を酔いLv別に眺められる |

### レイアウト

```
┌───────────────────────────────────────────────────┐
│ ← 戻る              🖼️ ギャラリー                │
├───────────────────────────────────────────────────┤
│  [ 🖼️ CG ]  [ 👗 立ち絵 ]                       │  ← タブ切替
├───────────────────────────────────────────────────┤
│                                                   │
│   （選択中タブの内容がここに表示される）             │
│                                                   │
└───────────────────────────────────────────────────┘
```

#### CGタブ（既存）

```
解放率: 3/10 (30%)

┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│肩寄せ│ │頭ﾎﾟﾝ │ │見つめ│ │ 🔒 │ │ 🔒 │  ← 通常CG
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ ???  │ │ ???  │ │ ???  │ │ ???  │  ← 隠しCG
└─────┘ └─────┘ └─────┘ └─────┘
```

#### 立ち絵タブ

```
┌───────┬───────────────────────────────────────────┐
│       │                                           │
│ BLAZE │          ┌─────────────────┐              │
│ [🔥]  │          │                 │              │
│       │          │   ブレイズ立ち絵  │              │
│ ???   │          │   （酔い演出適用）│              │
│ [🔒]  │          │                 │              │
│       │          │                 │              │
│ ???   │          └─────────────────┘              │
│ [🔒]  │                                           │
│       │   名前:  ブレイズ / BLAZE                  │
│       │   称号:  燃え盛る太陽                      │
│       │                                           │
│       │   酔いレベル:                              │
│       │   [Lv0] [Lv1] [Lv2] [Lv3🔒] [Lv4🔒]     │
│       │    シラフ ほろ酔い 酔い  ???    ???         │
│       │                                           │
│       │   💬 「なぁドクター、もう一杯いこうぜ」    │
│       │      ↻ セリフ切替                         │
│       │                                           │
│       │   📊 戦績: 5勝 2敗                        │
│       │   🖼️ CG解放率: 3/5                       │
│       │                                           │
└───────┴───────────────────────────────────────────┘
```

### 立ち絵鑑賞 — 解放条件

- **キャラ自体の解放**: そのキャラと1回以上対戦（勝敗不問）するとアンロック
- **酔いLv差分の解放**: バトル中にそのLvまで酔わせたことがあればアンロック

```ts
// useGameStore への追加
interface GameStore {
  // ... 既存 ...
  /** キャラ別: 到達したことのある最大酔いLv */
  maxDrunkReached: Record<CharacterId, number>;
  /** 対戦したことのあるキャラ */
  encounteredCharacters: Set<CharacterId>;

  updateMaxDrunk: (characterId: CharacterId, level: number) => void;
  addEncountered: (characterId: CharacterId) => void;
}
```

> バトル中にキャラの酔いが上がるたびに `updateMaxDrunk` を呼ぶ。
> 勝敗に関係なく「酔わせた最高Lv」が記録される。

### GalleryScreen コンポーネント（タブ統合版）

```tsx
type GalleryTab = 'cg' | 'portrait';

export const GalleryScreen = () => {
  const setScreen = useGameStore((s) => s.setScreen);
  const [activeTab, setActiveTab] = useState<GalleryTab>('cg');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setScreen('title')}>← 戻る</button>
        <h2>🖼️ ギャラリー</h2>
      </div>

      {/* タブ切替 */}
      <div className={styles.tabs}>
        <button
          className={clsx(styles.tab, { [styles.active]: activeTab === 'cg' })}
          onClick={() => setActiveTab('cg')}
        >
          🖼️ CG
        </button>
        <button
          className={clsx(styles.tab, { [styles.active]: activeTab === 'portrait' })}
          onClick={() => setActiveTab('portrait')}
        >
          👗 立ち絵
        </button>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'cg' && <CGGalleryTab />}
      {activeTab === 'portrait' && <PortraitTab />}
    </div>
  );
};
```

### PortraitTab コンポーネント

```tsx
const PortraitTab = () => {
  const encountered = useGameStore((s) => s.encounteredCharacters);
  const maxDrunk = useGameStore((s) => s.maxDrunkReached);

  const [selectedChar, setSelectedChar] = useState<CharacterId | null>(
    encountered.size > 0 ? [...encountered][0] : null
  );
  const [viewDrunkLevel, setViewDrunkLevel] = useState<DrunkLevelValue>(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const character = selectedChar ? CHARACTER_DATA[selectedChar] : null;
  const drunkInfo = character?.drunkLevels.find(l => l.level === viewDrunkLevel);
  const isLevelUnlocked = selectedChar
    ? (maxDrunk[selectedChar] ?? 0) >= viewDrunkLevel
    : false;

  return (
    <div className={styles.portraitLayout}>
      {/* 左: キャラ選択リスト */}
      <div className={styles.charList}>
        {Object.values(CHARACTER_DATA).map(c => {
          const unlocked = encountered.has(c.id);
          return (
            <button
              key={c.id}
              className={clsx(styles.charBtn, {
                [styles.selected]: selectedChar === c.id,
                [styles.locked]: !unlocked,
              })}
              onClick={() => unlocked && setSelectedChar(c.id)}
              disabled={!unlocked}
            >
              {unlocked ? c.theme.icon : '🔒'} {unlocked ? c.name : '???'}
            </button>
          );
        })}
      </div>

      {/* 右: 立ち絵表示エリア */}
      {character && (
        <div className={styles.viewArea}>
          <div className={styles.portraitFrame}>
            <CharacterSprite
              characterId={character.id}
              imageUrl={getPortrait(character.id, isLevelUnlocked ? viewDrunkLevel : 0)}
              drunkLevel={isLevelUnlocked ? viewDrunkLevel : 0}
              size="large"
            />
          </div>

          <div className={styles.charInfo}>
            <h3>{character.name} / {character.nameEn}</h3>
            <p className={styles.subtitle}>{character.subtitle}</p>
          </div>

          {/* 酔いレベル切替ボタン */}
          <div className={styles.drunkSelector}>
            <span>酔いレベル:</span>
            {character.drunkLevels.map(dl => {
              const unlocked = (maxDrunk[character.id] ?? 0) >= dl.level;
              return (
                <button
                  key={dl.level}
                  className={clsx(styles.lvBtn, {
                    [styles.active]: viewDrunkLevel === dl.level,
                    [styles.locked]: !unlocked,
                  })}
                  onClick={() => unlocked && setViewDrunkLevel(dl.level)}
                  disabled={!unlocked}
                >
                  {unlocked ? `Lv${dl.level} ${dl.name}` : `Lv${dl.level} 🔒`}
                </button>
              );
            })}
          </div>

          {/* セリフ表示 */}
          {isLevelUnlocked && drunkInfo && (
            <div className={styles.dialogue}>
              <p>💬 「{drunkInfo.lines[currentLineIndex]}」</p>
              <button onClick={() =>
                setCurrentLineIndex((currentLineIndex + 1) % drunkInfo.lines.length)
              }>
                ↻ セリフ切替
              </button>
            </div>
          )}

          {/* 戦績 */}
          <div className={styles.stats}>
            <span>📊 戦績: {wins}勝 {losses}敗</span>
            <span>🖼️ CG解放率: {unlockedCount}/{totalCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 酔いレベル切替時の演出

酔いレベルをクリックで切り替えた瞬間、立ち絵がスムーズに変化する。

```
Lv0 → Lv1 クリック:
  - 立ち絵が一瞬ふわっと揺れる（scale 1.02 → 1.0, 300ms）
  - 頬に赤みが追加される（opacity 0 → 0.15, 400ms）
  - セリフが切り替わる（フェードアウト → フェードイン）
  - 酔い揺れアニメーションが開始

Lv1 → Lv2 クリック:
  - 差分画像があれば crossfade（旧画像フェードアウト/新画像フェードイン, 500ms）
  - 赤みが強まる（opacity 0.15 → 0.3）
  - 揺れが大きくなる
  - 「うぅ…」的な SE が鳴る（将来）

Lv2 → Lv3 クリック:
  - 画面全体が少し暖色寄りに（CSSフィルタ transition）
  - 立ち絵の揺れが激しく
  - セリフがデレデレに
```

### バトル中の記録ロジック

```ts
// battle-engine.ts の applyDamageAndHeal 内に追加
function applyDamageAndHeal(result: RoundResult) {
  // ... 既存のダメージ/回復処理 ...

  // 酔いLvが上がったら記録
  const newDrunkLevel = GameState.getDrunkLevel(GameState.battle.opponentDrunk);
  const currentMax = GameState.maxDrunkReached[GameState.currentOpponent] ?? 0;
  if (newDrunkLevel > currentMax) {
    GameState.updateMaxDrunk(GameState.currentOpponent, newDrunkLevel);
  }
}
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
