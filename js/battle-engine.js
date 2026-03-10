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
      playerDamage: 0,
      opponentDamage: 0,
      playerHeal: 0,
      opponentHeal: 0,
      messages: [],
      cgEvent: null,
      instantWin: false,
      spillNullified: false,
      swapDrunk: false,
      reduceMaxRounds: 0,
    };

    // こぼしが前のラウンドで使われた場合は相手カード無効
    if (b.spillActive) {
      b.spillActive = false;
    }

    // === 戦略・環境・状態異常カード処理 ===
    if (pCard.type === 'strategy' || pCard.type === 'environment' || pCard.type === 'status') {
      this.resolveUtilityCard(pCard, result, 'player');
    }
    if (oCard.type === 'strategy' || oCard.type === 'environment' || oCard.type === 'status') {
      this.resolveUtilityCard(oCard, result, 'opponent');
    }
    // 両方ユーティリティなら終了
    if ((pCard.type === 'strategy' || pCard.type === 'environment' || pCard.type === 'status') &&
        (oCard.type === 'strategy' || oCard.type === 'environment' || oCard.type === 'status')) {
      this.applyDamageAndHeal(result);
      return result;
    }

    // === 一気飲み系カード処理 ===
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
   * 戦略・環境・状態異常カードの解決
   */
  resolveUtilityCard(card, result, user) {
    const isPlayer = user === 'player';
    switch (card.effect) {
      case 'rumor':
        result.messages.push(`${card.emoji} ${card.name}！${isPlayer ? '相手の次の手札が乱される！' : '次の手札が乱された！'}`);
        break;
      case 'distract':
      case 'reveal_and_debuff':
        result.messages.push(`${card.emoji} ${card.name}！${isPlayer ? '相手の手札が見えた！' : '手の内が見られた！'}`);
        break;
      case 'discard_highest':
        result.messages.push(`${card.emoji} ${card.name}！${isPlayer ? '相手の最強カードが没収された！' : '最強カードが奪われた！'}`);
        break;
      case 'swap_drunk':
        result.swapDrunk = true;
        result.messages.push(`${card.emoji} ${card.name}！酔いレベルが入れ替わった！`);
        break;
      case 'karaoke':
      case 'rhodes_party':
        result.messages.push(`${card.emoji} ${card.name}突入！ドリンクのダメージ+1！`);
        break;
      case 'lastorder':
        result.messages.push(`${card.emoji} ${card.name}！次のターン全力勝負！`);
        break;
      case 'dimlight':
        result.messages.push(`${card.emoji} ${card.name}…セクハラの条件が緩和…`);
        break;
      case 'penguin_vip':
        result.messages.push(`${card.emoji} ${card.name}に移動！二人きり＆セクハラ条件緩和！`);
        break;
      case 'babel_requiem':
        result.messages.push(`${card.emoji} ${card.name}…全ダメージ+1＆双方に持続ダメージ！`);
        break;
      case 'contingency_contract':
        result.reduceMaxRounds = card.reduceMaxRounds || 3;
        result.messages.push(`${card.emoji} ${card.name}！残りラウンドが${result.reduceMaxRounds}減少！`);
        break;
      case 'tipsy':
        result.messages.push(`${card.emoji} ${card.name}！${isPlayer ? '相手はほろ酔いに…' : 'ほろ酔い状態に…'}`);
        break;
      case 'blush':
        result.messages.push(`${card.emoji} ${card.name}！${isPlayer ? '相手は動揺状態に…' : '動揺してしまった…'}`);
        break;
      case 'alone':
        result.messages.push(`${card.emoji} ${card.name}…セクハラのダメージが2倍に！`);
        break;
    }
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
        result.messages.push(`🍻 ${chugCard.name}！相手に${chugCard.enemyDamage}ダメージ！自分にも${chugCard.selfDamage}ダメージ！`);
      } else {
        result.playerDamage = chugCard.enemyDamage;
        result.opponentDamage = chugCard.selfDamage;
        result.messages.push(`🍻 相手の${chugCard.name}！${chugCard.enemyDamage}ダメージを受けた！`);
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
    else if (chugCard.effect === 'roulette') {
      // ロドス深夜の闇鍋酒: 50/50ダメージ
      const roll = Math.random();
      if (roll < 0.5) {
        if (chugUser === 'player') {
          result.opponentDamage = 4;
          result.messages.push(`🎰 ${chugCard.name}…大当たり！相手に4ダメージ！`);
        } else {
          result.playerDamage = 4;
          result.messages.push(`🎰 相手の${chugCard.name}…大当たり！4ダメージを受けた！`);
        }
      } else {
        if (chugUser === 'player') {
          result.playerDamage = 3;
          result.messages.push(`🎰 ${chugCard.name}…ハズレ！自分に3ダメージ！`);
        } else {
          result.opponentDamage = 3;
          result.messages.push(`🎰 相手の${chugCard.name}…ハズレ！相手に3自爆ダメージ！`);
        }
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
        if (cardDef.sanityDamage) {
          result.playerDamage = cardDef.sanityDamage;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！理性が${cardDef.sanityDamage}削られた！`);
        } else if (cardDef.drunkDamage) {
          result.playerDamage = cardDef.drunkDamage;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！酔い+${cardDef.drunkDamage}！`);
        }
      }
    } else {
      result.messages.push(`${hCard.emoji} ${hCard.name}…不発！条件を満たしていない！`);
      if (user === 'player' && GameState.currentOpponent) {
        result.messages.push(randomPick(GameState.currentOpponent.battleLines.harassmentFail));
      }
    }

    // 相手のカードも処理（ドリンクならダメージ受ける）
    if (!result.spillNullified && otherCard.type === 'drink') {
      const dmg = getCardDamage(otherCard);
      if (user === 'player') {
        result.playerDamage = (result.playerDamage || 0) + dmg;
        result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
      } else {
        result.opponentDamage = (result.opponentDamage || 0) + dmg;
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

    // swap_drunk: 酔いLv入れ替え
    if (result.swapDrunk) {
      const temp = b.playerDrunk;
      b.playerDrunk = b.opponentDrunk;
      b.opponentDrunk = temp;
    }

    // ダメージ適用
    b.playerDrunk = Math.min(10, b.playerDrunk + result.playerDamage);
    b.opponentDrunk = Math.min(10, b.opponentDrunk + result.opponentDamage);
    // 回復適用
    b.playerDrunk = Math.max(0, b.playerDrunk - result.playerHeal);
    b.opponentDrunk = Math.max(0, b.opponentDrunk - result.opponentHeal);

    // maxRounds減少
    if (result.reduceMaxRounds > 0) {
      b.maxRounds = Math.max(b.round + 1, b.maxRounds - result.reduceMaxRounds);
    }
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
