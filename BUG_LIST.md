# バグリスト — Operation Nightcap (ロドスバー ～今夜は帰さない～)

生成日: 2026-03-05

---

## 重大度: Critical（ゲーム進行に直接影響）

### BUG-001: 逆セクハラの酔い判定が常に相手の酔い度を参照している

- **ファイル**: `src/engine/battleEngine.ts:401`
- **内容**: `resolveHarassmentCard`で、`user === 'opponent'`（相手がセクハラを使う場合）でも`battle.opponentDrunk`を参照している。本来はプレイヤーの酔い度（`battle.playerDrunk`）で判定すべき。
- **コード**:
  ```typescript
  const triggerDrunk = user === 'player' ? battle.opponentDrunk : battle.opponentDrunk;
  // ↑ 三項演算子の両方が同じ値
  ```
- **影響**: 逆セクハラの発動条件が正しく機能しない。相手の酔い度が低いと、プレイヤーが酔っていても逆セクハラが不発になる。

---

### BUG-002: `gaze`と`lap_pillow`のカード定義が存在しない

- **ファイル**: `src/data/cards.ts`（定義なし）、`src/data/characters.ts:136,219`（参照あり）、`src/data/shop.ts:48`（販売リストに掲載）
- **内容**: ブレイズのCGイベント`blaze_gaze`は`triggerCard: 'gaze'`、`blaze_lap`は`triggerCard: 'lap_pillow'`を参照するが、`CARD_DATA`にどちらも定義がない。また`shop.ts`の`availableCards`にも含まれている。
- **影響**:
  - ショップで購入しようとすると`CARD_DATA[cardId]`が`undefined`になりクラッシュの可能性
  - CGイベント`blaze_gaze`と`blaze_lap`が絶対に発動しない
  - 全8CG中2つが解放不能 → afterEventsの`requiredCGRate`条件を満たせない可能性

---

### BUG-003: `lastorder`カードが未実装（支払い損）

- **ファイル**: `src/engine/battleEngine.ts:312-315`
- **内容**: `lastorder`（ラストオーダー）カードはメッセージ表示のみで実際の効果（次ターン手札全使用可能）が未実装。TODOコメントあり。
- **コード**:
  ```typescript
  case 'lastorder':
    // TODO: 次のターン手札全使用可能（要UI対応、今はメッセージのみ）
    result.messages.push(`${card.emoji} ${card.name}！閉店間近…次のターン、全力勝負！`);
    break;
  ```
- **影響**: プレイヤーが1000龍門幣で購入しても何も起きない。ガチャから出ても効果なし。

---

## 重大度: High（ゲームバランス・機能に影響）

### BUG-004: `rumor`（噂話）の効果がストア側で未処理

- **ファイル**: `src/engine/battleEngine.ts:271-277`（フラグ設定）、`src/store/gameStore.ts`（処理なし）
- **内容**: `resolveUtilityCard`で`result.rumorActive = true`が設定されるが、`gameStore.ts`の`playRound`では`rumorActive`を一切チェックしていない。相手の手札差し替えが実行されない。
- **影響**: 600龍門幣のカードが完全に効果なし。

---

### BUG-005: `distract`（話題転換）の手札公開データがUIに渡されない

- **ファイル**: `src/engine/battleEngine.ts:292-298`（データ設定）、`src/store/gameStore.ts:294-304`（返却値に含まれない）
- **内容**: `result.revealedHand`に相手の手札情報が格納されるが、`playRound`の返却オブジェクトに`revealedHand`が含まれていない。UIは手札情報を受け取れない。
- **影響**: 500龍門幣のカードが効果なし。

---

### BUG-006: 手札汚染（corrupted slots）のゲームプレイ処理が未実装

- **ファイル**: `src/store/gameStore.ts:259-272`（フラグ設定）、`src/components/BattleScreen.tsx`（参照なし）
- **内容**: `corruptedSlots`配列はバトルステートに保存されるが:
  1. BattleScreen.tsxで汚染スロットの視覚表示がない
  2. 汚染カードを使用した際の自分へのダメージ処理がない
  3. 次のラウンドで`corruptedSlots`がリセットされるロジックもない
- **影響**: `dirty_talk`カードの手札汚染効果が見た目にも実効にも反映されない。

---

### BUG-007: つまみ vs つまみで回復が発生しない

- **ファイル**: `src/engine/battleEngine.ts:252-259`
- **内容**: 両プレイヤーがfoodカードを出した場合、メッセージ「平和なラウンド…お互いつまみを食べた」は表示されるが、`playerHeal`も`opponentHeal`も0のまま。
- **影響**: 両方つまみを出すと回復なしの無駄ターンになる。設計意図かバグか要確認。

---

### BUG-008: 両者がchugカードを出した場合、片方しか処理されない

- **ファイル**: `src/engine/battleEngine.ts:196-201`
- **内容**: プレイヤーのchugカードが先に処理され`return`で即座に返却。相手のchugカードは無視される。
- **コード**:
  ```typescript
  if (pCard.type === 'chug') {
    return this.resolveChugCard(pCard, oCard, result, 'player', battle);
  }
  if (oCard.type === 'chug') {
    return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
  }
  ```
- **影響**: 相手がchugを出しても、プレイヤーもchugなら相手のchug効果が発動しない（プレイヤー有利のバグ）。

---

### BUG-009: 両者がharassmentカードを出した場合、片方しか処理されない

- **ファイル**: `src/engine/battleEngine.ts:204-209`
- **内容**: BUG-008と同様。プレイヤーのharassmentが先に処理され、相手のharassmentは無視される。
- **影響**: 同上。

---

## 重大度: Medium（UI・表示・軽微なロジック問題）

### BUG-010: ハラスメント時の相手ドリンクカードにバフ効果が適用されない

- **ファイル**: `src/engine/battleEngine.ts:462-471`
- **内容**: ハラスメントカード処理中、相手のドリンクカードのダメージ計算が`getCardDamage(otherCard)`のみで、`applyDrinkBuffs()`を経由しない。karaoke、tipsy、atk_downなどのバフが無視される。
- **影響**: バフ適用中でも素のダメージ値が使われる。

---

### BUG-011: CG発動判定がバフ補正を考慮していない

- **ファイル**: `src/store/gameStore.ts:208-217`
- **内容**: `playRound`内のCGイベント発動判定では、`dimlight`や`excuse`バフによる`requiredDrunkLevel`補正が考慮されていない。`battleEngine.ts`側で`getAdjustedRequiredLevel`を使って成功判定するが、CG検索は`pCard.requiredDrunkLevel`をそのまま使う。
- **影響**: バフで条件緩和してハラスメント成功しても、CGが再生されないケースがある。

---

### BUG-012: 相手の逆セクハラCG発動判定が相手自身の酔い度で判定している

- **ファイル**: `src/store/gameStore.ts:222-232`
- **内容**: 相手のハラスメントカードのCG発動判定で`b.opponentDrunk`（相手の酔い度）を参照しているが、BUG-001と同じ問題で正しい判定対象が曖昧。
- **影響**: BUG-001と連動して不正なCG発動/非発動が起きる。

---

### BUG-013: 相手の`no_food`バフ未チェック（ドリンク vs 相手フード）

- **ファイル**: `src/engine/battleEngine.ts:231-237`
- **内容**: プレイヤーがドリンク、相手がフードの場合、相手の`no_food`バフがチェックされない。`no_food`チェックはプレイヤーのフード使用時（line 239）のみ。
- **影響**: 相手が`no_food`デバフ中でもフードで回復できてしまう。

---

### BUG-014: `useEffect`の依存配列不足

- **ファイル**: `src/components/BattleScreen.tsx:116-124`
- **内容**: 初回手札配りの`useEffect`で依存配列が空`[]`。`drawHands`や`battle`の参照が含まれていない。React strict modeで意図しない挙動の可能性。
- **影響**: 開発時の再レンダリングで手札が正しく配られない場合がある。

---

### BUG-015: ガチャで入手したカードが`inventory`にのみ追加され`playerDeck`に追加されない

- **ファイル**: `src/store/gameStore.ts:373-397`
- **内容**: `pullGacha`は`inventory`にカードを追加するが、`playerDeck`は変更しない。一方`buyCard`は`playerDeck`に直接追加する。ガチャで手に入れたカードをデッキに入れるUIが存在しない。
- **影響**: ガチャで引いたカードを実際のバトルで使用する手段がない（デッキ管理UIの欠如）。

---

### BUG-016: `breast_touch`と`hip_touch`のCGイベントにinstantWin未定義だがダメージが高い

- **ファイル**: `src/data/cards.ts:127-134`、`src/data/characters.ts:146-186`
- **内容**: これ自体はバグではないが、`breast_touch`（drunkDamage: 3）と`hip_touch`（drunkDamage: 2）の`requiredDrunkLevel`が共に2で、`alone`バフ使用時にダメージが6や4になり、即座にゲーム終了級のダメージになる。
- **影響**: バランス上の懸念。`alone`+`blush`が揃うと`breast_touch`で酔い+8が可能。

---

## 重大度: Low（軽微・コスメティック）

### BUG-017: `atk_down`メッセージがプレイヤー側のみ表示

- **ファイル**: `src/engine/battleEngine.ts:216-218`
- **内容**: ドリンクvドリンク時の`atk_down`メッセージは`battle.playerBuffs`のみチェック。相手が`atk_down`状態でもメッセージが出ない。
- **影響**: 表示上の不整合のみ。バフ効果自体は`applyDrinkBuffs`で正しく適用される。

---

### BUG-018: `spill`（こぼし）の手札減少ペナルティが使用者側になっていない場合がある

- **ファイル**: `src/engine/battleEngine.ts:386-394`
- **内容**: `spill`の説明文は「次ターン**自分の**手札が3枚」だが、`chugUser === 'opponent'`の場合は`opponentReducedHand = true`で相手の手札が減る。相手が`spill`を使った場合、相手自身のペナルティであるべきだが、メッセージと実装の対応を確認すると、相手が使った場合「相手の次ラウンド手札3枚」とあり、これは正しい。ただし**プレイヤーのカード無効化**が行われるので、相手のspillでプレイヤーのカードが無効になるのは正しいが、手札減少は相手側に来るべき。
- **影響**: 軽微。spill使用者のペナルティ方向を要確認。

---

### BUG-019: ショップに`gaze`と`lap_pillow`が掲載されているが購入不可

- **ファイル**: `src/data/shop.ts:48`
- **内容**: BUG-002の派生。`availableCards`に含まれているが`CARD_DATA`に定義がないため、ショップのUIで`null`が返りレンダリングされない。
- **影響**: ショップのハラスメントカテゴリに表示されない（サイレントエラー）。

---

## まとめ

| 重大度 | 件数 |
|--------|------|
| Critical | 3件 |
| High | 6件 |
| Medium | 7件 |
| Low | 3件 |
| **合計** | **19件** |

### 優先修正推奨順

1. **BUG-002** — カード定義追加（`gaze`, `lap_pillow`）→ CG解放ブロック解除
2. **BUG-001** — 逆セクハラ酔い判定修正 → ゲームロジック根幹
3. **BUG-004/005** — rumor/distract効果の実装 → 購入可能カードの効果なし
4. **BUG-003** — lastorder実装 → 同上
5. **BUG-006** — 手札汚染の実装
6. **BUG-008/009** — chug/harassment同時出し処理
7. **BUG-010/011/012/013** — バフ・判定系修正
8. **BUG-015** — ガチャ→デッキ追加UIの実装
