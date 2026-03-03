/**
 * バトルエンジン - カード効果処理
 */
const BattleEngine = {
  /**
   * 手札を配る
   */
  drawHands() {
    const b = GameState.battle;
    const handSize = b.playerReducedHand ? 3 : 4;
    b.playerReducedHand = false; // リセット

    // プレイヤー手札
    b.playerHand = [];
    const pCount = Math.min(handSize, b.playerDeckRemaining.length);
    for (let i = 0; i < pCount; i++) {
      b.playerHand.push(b.playerDeckRemaining.shift());
    }

    // 相手手札
    let opponentHandSize = 4;
    if (b.opponentDiscardNext) {
      opponentHandSize = 4; // 一旦4枚引いてから1枚破棄
    }
    b.opponentHand = [];
    const oCount = Math.min(opponentHandSize, b.opponentDeckRemaining.length);
    for (let i = 0; i < oCount; i++) {
      b.opponentHand.push(b.opponentDeckRemaining.shift());
    }

    // 乾杯強制の効果：相手の手札1枚ランダム破棄
    if (b.opponentDiscardNext && b.opponentHand.length > 1) {
      const discardIdx = Math.floor(Math.random() * b.opponentHand.length);
      b.opponentHand.splice(discardIdx, 1);
      b.opponentDiscardNext = false;
    }
  },

  /**
   * ラウンド処理
   * @returns {Object} ラウンド結果
   */
  resolveRound(playerCardId, opponentCardId) {
    const pCard = CARD_DATA[playerCardId];
    const oCard = CARD_DATA[opponentCardId];
    const b = GameState.battle;
    const result = {
      playerCard: pCard,
      opponentCard: oCard,
      playerDamage: 0,    // プレイヤーが受けたダメージ
      opponentDamage: 0,  // 相手が受けたダメージ
      playerHeal: 0,
      opponentHeal: 0,
      messages: [],
      cgEvent: null,
      instantWin: false,
      spillNullified: false
    };

    // こぼしが前のラウンドで使われた場合は相手カード無効
    if (b.spillActive) {
      b.spillActive = false;
      // こぼしはもう処理済み、ここでは特に何もしない
    }

    // === 一気飲み系カード処理（先に処理、相手カード関係なし） ===
    if (pCard.type === 'chug') {
      return this.resolveChugCard(pCard, oCard, result, 'player');
    }
    if (oCard.type === 'chug') {
      return this.resolveChugCard(oCard, pCard, result, 'opponent');
    }

    // === セクハラカード処理 ===
    if (pCard.type === 'harassment') {
      return this.resolveHarassmentCard(pCard, oCard, result, 'player');
    }
    if (oCard.type === 'harassment') {
      return this.resolveHarassmentCard(oCard, pCard, result, 'opponent');
    }

    // === ドリンク vs ドリンク ===
    if (pCard.type === 'drink' && oCard.type === 'drink') {
      const pDmg = getCardDamage(pCard);
      const oDmg = getCardDamage(oCard);
      if (pDmg > oDmg) {
        result.opponentDamage = pDmg - oDmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}(${pDmg}) vs ${oCard.emoji} ${oCard.name}(${oDmg}) → 差分${result.opponentDamage}ダメージ！`);
      } else if (oDmg > pDmg) {
        result.playerDamage = oDmg - pDmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}(${oDmg}) vs ${pCard.emoji} ${pCard.name}(${pDmg}) → 差分${result.playerDamage}ダメージ！`);
      } else {
        result.messages.push(`${pCard.emoji} vs ${oCard.emoji} 同値！相殺！`);
      }
    }
    // === ドリンク vs つまみ ===
    else if (pCard.type === 'drink' && oCard.type === 'food') {
      const pDmg = getCardDamage(pCard);
      result.opponentDamage = pDmg;
      result.opponentHeal = oCard.heal === 99 ? Math.max(0, b.opponentDrunk + pDmg) : oCard.heal;
      result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
      result.messages.push(`${oCard.emoji} ${oCard.name}で${result.opponentHeal}回復！`);
    }
    else if (pCard.type === 'food' && oCard.type === 'drink') {
      const oDmg = getCardDamage(oCard);
      result.playerDamage = oDmg;
      result.playerHeal = pCard.heal === 99 ? Math.max(0, b.playerDrunk + oDmg) : pCard.heal;
      result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
      result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      result.messages.push('平和なラウンド…お互いつまみを食べた');
    }

    // ダメージ適用
    this.applyDamageAndHeal(result);
    return result;
  },

  /**
   * 一気飲みカード処理
   */
  resolveChugCard(chugCard, otherCard, result, chugUser) {
    const b = GameState.battle;

    if (chugCard.effect === 'chug') {
      if (chugUser === 'player') {
        result.opponentDamage = chugCard.enemyDamage;
        result.playerDamage = chugCard.selfDamage;
        result.messages.push(`🍻 一気飲み！相手に${chugCard.enemyDamage}ダメージ！自分にも${chugCard.selfDamage}ダメージ！`);
      } else {
        result.playerDamage = chugCard.enemyDamage;
        result.opponentDamage = chugCard.selfDamage;
        result.messages.push(`🍻 相手が一気飲み！${chugCard.enemyDamage}ダメージを受けた！`);
      }
    }
    else if (chugCard.effect === 'toast') {
      if (chugUser === 'player') {
        result.opponentDamage = chugCard.enemyDamage;
        result.playerDamage = chugCard.selfDamage;
        b.opponentDiscardNext = true;
        result.messages.push(`🥂 乾杯強制！相手に${chugCard.enemyDamage}ダメージ＋次のラウンド手札1枚破棄！`);
      } else {
        result.playerDamage = chugCard.enemyDamage;
        result.opponentDamage = chugCard.selfDamage;
        // AIが乾杯強制を使った場合、プレイヤーに影響（簡略化：手札減少なし）
        result.messages.push(`🥂 相手が乾杯強制！${chugCard.enemyDamage}ダメージ！`);
      }
    }
    else if (chugCard.effect === 'spill') {
      result.spillNullified = true;
      if (chugUser === 'player') {
        b.playerReducedHand = true;
        result.messages.push('🫗 こぼし！相手のカードを無効化！（次のラウンド手札3枚）');
      } else {
        result.messages.push('🫗 相手がこぼし！カードが無効化された！');
      }
    }

    this.applyDamageAndHeal(result);
    return result;
  },

  /**
   * セクハラカード処理
   */
  resolveHarassmentCard(hCard, otherCard, result, user) {
    const b = GameState.battle;
    const targetDrunk = user === 'player' ? b.opponentDrunk : b.playerDrunk;
    const targetLevel = GameState.getDrunkLevel(targetDrunk);
    const cardDef = CARD_DATA[hCard.id];

    if (targetLevel >= cardDef.requiredDrunkLevel) {
      // 成功
      if (user === 'player') {
        if (cardDef.instantWin) {
          result.instantWin = true;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！`);
        } else {
          result.opponentDamage = cardDef.drunkDamage;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！酔い+${cardDef.drunkDamage}！`);
        }
        // CGイベント検索
        const char = GameState.currentOpponent;
        if (char) {
          const cgEvent = char.cgEvents.find(e => e.triggerCard === hCard.id);
          if (cgEvent) {
            result.cgEvent = cgEvent;
            GameState.unlockedCGs.add(cgEvent.id);
            GameState.save();
          }
        }
      } else {
        // AIがセクハラカードを使うことは通常ない（プレイヤー専用想定）
        result.messages.push(`${hCard.emoji} 不思議なことが起きた…`);
      }
    } else {
      // 不発
      result.messages.push(`${hCard.emoji} ${hCard.name}…不発！条件を満たしていない！`);
      if (user === 'player') {
        result.messages.push(randomPick(GameState.currentOpponent.battleLines.harassmentFail));
      }
    }

    // 相手のカードも処理（ドリンクならダメージ受ける）
    if (!result.spillNullified && otherCard.type === 'drink') {
      const dmg = getCardDamage(otherCard);
      if (user === 'player') {
        result.playerDamage = dmg;
        result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
      } else {
        result.opponentDamage = dmg;
      }
    }

    this.applyDamageAndHeal(result);
    return result;
  },

  /**
   * ダメージと回復を適用
   */
  applyDamageAndHeal(result) {
    const b = GameState.battle;
    // ダメージ適用
    b.playerDrunk = Math.min(10, b.playerDrunk + result.playerDamage);
    b.opponentDrunk = Math.min(10, b.opponentDrunk + result.opponentDamage);
    // 回復適用
    b.playerDrunk = Math.max(0, b.playerDrunk - result.playerHeal);
    b.opponentDrunk = Math.max(0, b.opponentDrunk - result.opponentHeal);
  },

  /**
   * 勝敗判定
   */
  checkGameEnd() {
    const b = GameState.battle;
    if (b.opponentDrunk >= 10) return 'player_win';
    if (b.playerDrunk >= 10) return 'opponent_win';
    if (b.round >= b.maxRounds) {
      if (b.playerDrunk < b.opponentDrunk) return 'player_win';
      if (b.playerDrunk > b.opponentDrunk) return 'opponent_win';
      return 'draw';
    }
    return null;
  }
};
