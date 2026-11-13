import {
  Card,
  ClientGameState,
  DamageElement,
  GameEventLog,
  GamePhase,
  Hero,
  PendingResponse,
  PlayerState,
  PublicPlayerState,
  ServerGameState,
} from './types';
import { HEROES_DATABASE } from './heroes';
import { createStandardDeck, shuffleDeck } from './cards';
import {
  calculateDistance,
  canShaTarget,
  calculateExcessCards,
  resolveDamage,
  isRedCard,
  isBlackCard,
  getSuitSymbol,
  formatCardNumber,
} from './rules';

export class SanGuoShaEngine {
  /**
   * Initialize a new 2-player match
   */
  static initGame(
    p1: { userId: string; username: string; avatar: string },
    p2: { userId: string; username: string; avatar: string }
  ): ServerGameState {
    // Pick 2 distinct random heroes from database
    const shuffledHeroes = [...HEROES_DATABASE].sort(() => Math.random() - 0.5);
    const hero1 = shuffledHeroes[0];
    const hero2 = shuffledHeroes[1];

    // Build & shuffle standard 108 card deck
    const deck = shuffleDeck(createStandardDeck());

    // Deal 4 initial cards to each player
    const hand1 = deck.splice(0, 4);
    const hand2 = deck.splice(0, 4);

    const player1: PlayerState = {
      userId: p1.userId,
      username: p1.username,
      avatar: p1.avatar || hero1.avatar,
      hero: hero1,
      hp: hero1.initialHp,
      maxHp: hero1.maxHp,
      hand: hand1,
      equipment: {},
      judges: [],
      isDying: false,
      drinkBuff: false,
      slashCountThisTurn: 0,
      chained: false,
      skillUsageCount: {},
      online: true,
      ready: true,
      surrendered: false,
    };

    const player2: PlayerState = {
      userId: p2.userId,
      username: p2.username,
      avatar: p2.avatar || hero2.avatar,
      hero: hero2,
      hp: hero2.initialHp,
      maxHp: hero2.maxHp,
      hand: hand2,
      equipment: {},
      judges: [],
      isDying: false,
      drinkBuff: false,
      slashCountThisTurn: 0,
      chained: false,
      skillUsageCount: {},
      online: true,
      ready: true,
      surrendered: false,
    };

    // Server randomly selects first player
    const isFirstPlayerP1 = Math.random() < 0.5;
    const firstPlayer = isFirstPlayerP1 ? player1 : player2;

    const gameId = 'game_' + Math.random().toString(36).substring(2, 9);
    const game: ServerGameState = {
      gameId,
      roomId: '',
      players: [player1, player2],
      currentTurnPlayerId: firstPlayer.userId,
      phase: 'PLAY', // Begin in Play phase for first turn
      turnNumber: 1,
      drawDeck: deck,
      discardPile: [],
      eventLogs: [],
      status: 'PLAYING',
      createdAt: Date.now(),
    };

    this.addLog(
      game,
      `【游戏开始】服务器随机决定先手：【${firstPlayer.username}（${firstPlayer.hero.name}）】获得先攻权！`,
      'INFO'
    );
    this.addLog(
      game,
      `双方各摸 4 张起始手牌。${player1.username}武将为【${player1.hero.name}】，${player2.username}武将为【${player2.hero.name}】。`,
      'INFO'
    );

    return game;
  }

  /**
   * Log game events with timestamp
   */
  static addLog(game: ServerGameState, text: string, type: GameEventLog['type'] = 'INFO') {
    game.eventLogs.push({
      id: 'log_' + Math.random().toString(36).substring(2, 8),
      timestamp: Date.now(),
      text,
      type,
    });
    if (game.eventLogs.length > 50) {
      game.eventLogs.shift();
    }
  }

  /**
   * Draw N cards for player, reshuffling discard pile if needed
   */
  static drawCards(game: ServerGameState, player: PlayerState, count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (game.drawDeck.length === 0) {
        if (game.discardPile.length === 0) break;
        this.addLog(game, '牌堆耗尽，将弃牌堆重新洗牌作为摸牌堆！', 'INFO');
        game.drawDeck = shuffleDeck(game.discardPile);
        game.discardPile = [];
      }
      const card = game.drawDeck.pop();
      if (card) {
        player.hand.push(card);
        drawn.push(card);
      }
    }
    return drawn;
  }

  /**
   * Draw a card for judgment (does not go to player's hand)
   */
  static drawJudgeCard(game: ServerGameState): Card {
    if (game.drawDeck.length === 0) {
      game.drawDeck = shuffleDeck(game.discardPile);
      game.discardPile = [];
    }
    return game.drawDeck.pop() || createStandardDeck()[0];
  }

  static getPlayer(game: ServerGameState, userId: string): PlayerState {
    const p = game.players.find(pl => pl.userId === userId);
    if (!p) throw new Error('玩家不在当前对局中');
    return p;
  }

  static getOpponent(game: ServerGameState, userId: string): PlayerState {
    const p = game.players.find(pl => pl.userId !== userId);
    if (!p) throw new Error('对手不存在');
    return p;
  }

  /**
   * Play a card from hand
   */
  static playCard(
    game: ServerGameState,
    userId: string,
    cardId: string,
    targetUserId?: string,
    options?: { convertedName?: string }
  ) {
    if (game.status !== 'PLAYING') throw new Error('对局已结束');
    if (game.pendingResponse) throw new Error('当前有待响应的操作，请先响应');
    if (game.currentTurnPlayerId !== userId) throw new Error('不是你的回合');
    if (game.phase !== 'PLAY') throw new Error('当前阶段不允许出牌');

    const player = this.getPlayer(game, userId);
    const opponent = this.getOpponent(game, userId);
    const target = targetUserId ? this.getPlayer(game, targetUserId) : opponent;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) throw new Error('手牌中不存在该卡牌');
    const card = player.hand[cardIndex];

    const effectiveName = options?.convertedName || card.name;
    const cardSuitStr = `${getSuitSymbol(card.suit)}${formatCardNumber(card.number)}`;

    // Handle Basic Cards
    if (card.type === 'BASIC' || card.subType === 'SHA') {
      if (effectiveName.includes('杀') || card.subType === 'SHA') {
        const check = canShaTarget(player, target);
        if (!check.allowed) throw new Error(check.reason || '无法对目标使用杀');

        // Remove card from hand
        player.hand.splice(cardIndex, 1);
        game.lastPlayedCard = card;
        player.slashCountThisTurn += 1;

        this.addLog(
          game,
          `【${player.username}】对【${target.username}】使用了【${card.name}】(${cardSuitStr})`,
          'PLAY'
        );

        // Check weapon abilities on Sha
        if (player.equipment.weapon?.name === '雌雄双股剑' && player.hero.gender !== target.hero.gender) {
          this.addLog(game, `【${player.username}】触发【雌雄双股剑】：目标异性受到压制！`, 'INFO');
        }

        // Set pending response for target
        const isLuBuWushuang = player.hero.skills.some(s => s.id === 'wushuang');
        const requiredShan = isLuBuWushuang ? 2 : 1;

        game.pendingResponse = {
          type: 'SHA_RESPONSE',
          sourcePlayerId: player.userId,
          targetPlayerId: target.userId,
          card,
          requiredCardType: 'SHAN',
          prompt: isLuBuWushuang
            ? `【${player.username}】发动【无双】，你须打出 2 张【闪】才能抵消此杀！`
            : `【${player.username}】对你使用了【${card.name}】，请打出【闪】抵消，或选择不出受到伤害。`,
          sourceCardName: card.name,
          requiredCount: requiredShan,
          providedCount: 0,
          timeoutSeconds: 20,
        };
        return;
      }

      if (effectiveName === '桃' || card.subType === 'TAO') {
        if (player.hp >= player.maxHp) throw new Error('体力已满，无需使用桃');
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        player.hp = Math.min(player.maxHp, player.hp + 1);
        this.addLog(game, `【${player.username}】使用了【桃】(${cardSuitStr})，回复 1 点体力（当前体力 ${player.hp}/${player.maxHp}）`, 'HEAL');
        return;
      }

      if (effectiveName === '酒' || card.subType === 'JIU') {
        if (player.drinkBuff) throw new Error('本回合已使用过酒');
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        player.drinkBuff = true;
        this.addLog(game, `【${player.username}】使用了【酒】(${cardSuitStr})，本回合下一张【杀】伤害 +1！`, 'PLAY');
        return;
      }
    }

    // Handle Trick Cards
    if (card.type === 'TRICK') {
      // Check Huang Yueying 'jizhi' skill (draw 1 card when playing non-delayed trick)
      const hasJizhi = player.hero.skills.some(s => s.id === 'jizhi');

      if (card.subType === 'WU_ZHONG_SHENG_YOU') {
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】使用了【无中生有】(${cardSuitStr})，摸两张牌！`, 'PLAY');
        this.drawCards(game, player, 2);
        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'GUO_HE_CHAI_QIAO') {
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;

        // Discard target's card: preference for equip, or random hand
        let discardedCard: Card | undefined;
        if (target.equipment.weapon) {
          discardedCard = target.equipment.weapon;
          target.equipment.weapon = undefined;
        } else if (target.equipment.armor) {
          discardedCard = target.equipment.armor;
          target.equipment.armor = undefined;
        } else if (target.equipment.defHorse) {
          discardedCard = target.equipment.defHorse;
          target.equipment.defHorse = undefined;
        } else if (target.equipment.offHorse) {
          discardedCard = target.equipment.offHorse;
          target.equipment.offHorse = undefined;
        } else if (target.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * target.hand.length);
          discardedCard = target.hand.splice(randIdx, 1)[0];
        }

        if (discardedCard) {
          game.discardPile.push(discardedCard);
          this.addLog(game, `【${player.username}】对【${target.username}】使用了【过河拆桥】，弃置了其【${discardedCard.name}】！`, 'PLAY');
        } else {
          this.addLog(game, `【${player.username}】使用了【过河拆桥】，但目标没有任何牌可弃。`, 'PLAY');
        }

        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'SHUN_SHOU_QIAN_YANG') {
        // Lu Xun 'qianxun' is immune to Shun Shou Qian Yang
        if (target.hero.skills.some(s => s.id === 'qianxun')) {
          throw new Error('目标武将拥有【谦逊】，不能成为【顺手牵羊】的目标');
        }

        // Distance check: distance <= 1 (Huang Yueying Qicai ignores distance)
        const hasQicai = player.hero.skills.some(s => s.id === 'qicai');
        const dist = calculateDistance(player, target);
        if (!hasQicai && dist > 1) {
          throw new Error(`距离不足（当前距离 ${dist}，顺手牵羊距离限制为 1）`);
        }

        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;

        let stolenCard: Card | undefined;
        if (target.equipment.weapon) {
          stolenCard = target.equipment.weapon;
          target.equipment.weapon = undefined;
        } else if (target.equipment.armor) {
          stolenCard = target.equipment.armor;
          target.equipment.armor = undefined;
        } else if (target.equipment.defHorse) {
          stolenCard = target.equipment.defHorse;
          target.equipment.defHorse = undefined;
        } else if (target.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * target.hand.length);
          stolenCard = target.hand.splice(randIdx, 1)[0];
        }

        if (stolenCard) {
          player.hand.push(stolenCard);
          this.addLog(game, `【${player.username}】对【${target.username}】使用了【顺手牵羊】，夺取了【${stolenCard.name}】！`, 'PLAY');
        } else {
          this.addLog(game, `【${player.username}】使用了【顺手牵羊】，但目标无牌可取。`, 'PLAY');
        }

        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'JUE_DOU') {
        // Kongcheng check
        if (target.hero.skills.some(s => s.id === 'kongcheng') && target.hand.length === 0) {
          throw new Error('目标处于【空城】状态，不能成为【决斗】的目标');
        }

        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】对【${target.username}】使用了【决斗】(${cardSuitStr})！`, 'PLAY');

        game.pendingResponse = {
          type: 'DUEL_RESPONSE',
          sourcePlayerId: player.userId,
          targetPlayerId: target.userId,
          card,
          requiredCardType: 'SHA',
          prompt: `【${player.username}】与你决斗！请打出一张【杀】，否则受到 1 点伤害！`,
          sourceCardName: '决斗',
          requiredCount: 1,
          providedCount: 0,
          timeoutSeconds: 20,
        };

        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'NAN_MAN_RU_QIN') {
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】使用了【南蛮入侵】(${cardSuitStr})！`, 'PLAY');

        game.pendingResponse = {
          type: 'NANMAN_RESPONSE',
          sourcePlayerId: player.userId,
          targetPlayerId: target.userId,
          card,
          requiredCardType: 'SHA',
          prompt: `【南蛮入侵】来袭！请打出一张【杀】，否则受到 1 点伤害！`,
          sourceCardName: '南蛮入侵',
          requiredCount: 1,
          providedCount: 0,
          timeoutSeconds: 20,
        };

        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'WAN_JIAN_QI_FA') {
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】使用了【万箭齐发】(${cardSuitStr})！`, 'PLAY');

        game.pendingResponse = {
          type: 'WANJIAN_RESPONSE',
          sourcePlayerId: player.userId,
          targetPlayerId: target.userId,
          card,
          requiredCardType: 'SHAN',
          prompt: `【万箭齐发】万矢齐发！请打出一张【闪】，否则受到 1 点伤害！`,
          sourceCardName: '万箭齐发',
          requiredCount: 1,
          providedCount: 0,
          timeoutSeconds: 20,
        };

        if (hasJizhi) {
          this.addLog(game, `【${player.username}】发动【集智】：摸一张牌！`, 'SKILL');
          this.drawCards(game, player, 1);
        }
        return;
      }

      if (card.subType === 'TAO_YUAN_JIE_YI') {
        player.hand.splice(cardIndex, 1);
        game.discardPile.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】使用了【桃园结义】(${cardSuitStr})，全场回复体力！`, 'PLAY');
        if (player.hp < player.maxHp) player.hp += 1;
        if (target.hp < target.maxHp) target.hp += 1;
        return;
      }

      // Delayed Tricks
      if (card.subType === 'LE_BU_SI_SHU') {
        if (target.hero.skills.some(s => s.id === 'qianxun')) {
          throw new Error('目标拥有【谦逊】，不能成为【乐不思蜀】的目标');
        }
        if (target.judges.some(c => c.subType === 'LE_BU_SI_SHU')) {
          throw new Error('目标判定区已有乐不思蜀');
        }
        player.hand.splice(cardIndex, 1);
        target.judges.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】对【${target.username}】使用了【乐不思蜀】！`, 'PLAY');
        return;
      }

      if (card.subType === 'BING_LIANG_CUN_DUAN') {
        const dist = calculateDistance(player, target);
        if (dist > 1) throw new Error('兵粮寸断使用距离须为 1');
        if (target.judges.some(c => c.subType === 'BING_LIANG_CUN_DUAN')) {
          throw new Error('目标判定区已有兵粮寸断');
        }
        player.hand.splice(cardIndex, 1);
        target.judges.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】对【${target.username}】使用了【兵粮寸断】！`, 'PLAY');
        return;
      }

      if (card.subType === 'SHAN_DIAN') {
        if (player.judges.some(c => c.subType === 'SHAN_DIAN')) {
          throw new Error('判定区已存在闪电');
        }
        player.hand.splice(cardIndex, 1);
        player.judges.push(card);
        game.lastPlayedCard = card;
        this.addLog(game, `【${player.username}】在自己判定区挂上了【闪电】！`, 'PLAY');
        return;
      }
    }

    // Handle Equipment Cards
    if (card.type === 'EQUIPMENT') {
      player.hand.splice(cardIndex, 1);
      game.lastPlayedCard = card;

      let oldEquip: Card | undefined;
      if (card.subType === 'WEAPON') {
        oldEquip = player.equipment.weapon;
        player.equipment.weapon = card;
      } else if (card.subType === 'ARMOR') {
        oldEquip = player.equipment.armor;
        player.equipment.armor = card;
      } else if (card.subType === 'DEFENSIVE_HORSE') {
        oldEquip = player.equipment.defHorse;
        player.equipment.defHorse = card;
      } else if (card.subType === 'OFFENSIVE_HORSE') {
        oldEquip = player.equipment.offHorse;
        player.equipment.offHorse = card;
      }

      if (oldEquip) {
        game.discardPile.push(oldEquip);
        // Sun Shangxiang Xiaoji skill: draw 2 cards when losing an equipment
        if (player.hero.skills.some(s => s.id === 'xiaoji')) {
          this.addLog(game, `【${player.username}】失去原装备【${oldEquip.name}】，触发【枭姬】摸两张牌！`, 'SKILL');
          this.drawCards(game, player, 2);
        }
        // Baiyin Shizi recover 1 HP when lost
        if (oldEquip.name === '白银狮子' && player.hp < player.maxHp) {
          player.hp += 1;
          this.addLog(game, `【${player.username}】失去【白银狮子】，回复 1 点体力！`, 'HEAL');
        }
      }

      this.addLog(game, `【${player.username}】装备了【${card.name}】(${cardSuitStr})`, 'EQUIP');
      return;
    }

    throw new Error(`卡牌【${card.name}】暂不支持当前使用方式`);
  }

  /**
   * Handle card response (e.g. playing Shan vs Sha, Sha in Duel, rescue)
   */
  static respondCard(game: ServerGameState, userId: string, cardId?: string, action?: 'PASS' | 'BAGUA') {
    if (!game.pendingResponse) throw new Error('当前无需响应');
    const pr = game.pendingResponse;
    if (pr.targetPlayerId !== userId) throw new Error('未轮到你响应');

    const target = this.getPlayer(game, userId);
    const source = this.getPlayer(game, pr.sourcePlayerId);

    // If player chooses to trigger Bagua Zhen
    if (action === 'BAGUA' && target.equipment.armor?.name === '八卦阵') {
      const judgeCard = this.drawJudgeCard(game);
      const isRed = isRedCard(judgeCard);
      this.addLog(
        game,
        `【${target.username}】发动【八卦阵】判定：判定牌为【${judgeCard.name}】(${getSuitSymbol(judgeCard.suit)}${formatCardNumber(judgeCard.number)}) - ${isRed ? '【红色成功！】视为打出闪！' : '【黑色失败】'}`,
        'JUDGE'
      );
      game.discardPile.push(judgeCard);

      if (isRed) {
        pr.providedCount += 1;
        if (pr.providedCount >= pr.requiredCount) {
          this.addLog(game, `【${target.username}】成功化解了【${source.username}】的攻势！`, 'INFO');
          game.pendingResponse = undefined;
          return;
        }
      }
    }

    // If player passes / takes damage
    if (action === 'PASS' || !cardId) {
      if (pr.type === 'SHA_RESPONSE') {
        const damageRes = resolveDamage(source, target, 1, pr.card?.element || 'NORMAL', pr.card);
        game.pendingResponse = undefined;
        if (damageRes.blocked) {
          this.addLog(game, `【${target.username}】未出闪，但由于${damageRes.reason}，未受到伤害！`, 'DAMAGE');
        } else {
          this.addLog(
            game,
            `【${target.username}】未能打出【闪】，受到来自【${source.username}】的 ${damageRes.finalDamage} 点伤害！`,
            'DAMAGE'
          );
          this.applyDamage(game, target, damageRes.finalDamage, source, pr.card);
        }
        return;
      }

      if (pr.type === 'DUEL_RESPONSE' || pr.type === 'NANMAN_RESPONSE') {
        game.pendingResponse = undefined;
        this.addLog(game, `【${target.username}】未能打出【杀】，受到 1 点伤害！`, 'DAMAGE');
        this.applyDamage(game, target, 1, source);
        return;
      }

      if (pr.type === 'WANJIAN_RESPONSE') {
        game.pendingResponse = undefined;
        this.addLog(game, `【${target.username}】未能打出【闪】，受到 1 点伤害！`, 'DAMAGE');
        this.applyDamage(game, target, 1, source);
        return;
      }

      if (pr.type === 'DYING_RESCUE') {
        // Player cannot rescue self -> Dies!
        target.isDying = false;
        game.pendingResponse = undefined;
        game.status = 'ENDED';
        game.winnerId = source.userId;
        game.endReason = `【${target.username}（${target.hero.name}）】体力归零阵亡！【${source.username}（${source.hero.name}）】大获全胜！`;
        this.addLog(game, game.endReason, 'INFO');
        return;
      }

      game.pendingResponse = undefined;
      return;
    }

    // Normal card response
    const cardIdx = target.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) throw new Error('手牌中不存在该响应牌');
    const card = target.hand[cardIdx];

    // Check Zhao Yun 'longdan' conversion: Sha <-> Shan
    const hasLongdan = target.hero.skills.some(s => s.id === 'longdan');
    const isShan = card.subType === 'SHAN' || (hasLongdan && card.subType === 'SHA');
    const isSha = card.subType === 'SHA' || (hasLongdan && card.subType === 'SHAN');

    if (pr.type === 'SHA_RESPONSE') {
      if (!isShan) throw new Error('需要打出【闪】响应');
      target.hand.splice(cardIdx, 1);
      game.discardPile.push(card);
      pr.providedCount += 1;

      // Zhang Jiao 'leiji' skill trigger on Shan
      if (target.hero.skills.some(s => s.id === 'leiji')) {
        const judge = this.drawJudgeCard(game);
        this.addLog(
          game,
          `【${target.username}】出闪触发【雷击】判定：判定牌为【${judge.name}】(${getSuitSymbol(judge.suit)}${formatCardNumber(judge.number)})`,
          'SKILL'
        );
        game.discardPile.push(judge);
        if (judge.suit === 'SPADE') {
          this.addLog(game, `【雷击成功！】黑桃判定，【${source.username}】受到 2 点雷电伤害！`, 'DAMAGE');
          this.applyDamage(game, source, 2, target, undefined, 'THUNDER');
        }
      }

      this.addLog(game, `【${target.username}】打出了【闪】(${getSuitSymbol(card.suit)}${formatCardNumber(card.number)})！`, 'PLAY');

      if (pr.providedCount >= pr.requiredCount) {
        this.addLog(game, `【${target.username}】成功抵消了【杀】！`, 'INFO');
        game.pendingResponse = undefined;
      }
      return;
    }

    if (pr.type === 'DUEL_RESPONSE') {
      if (!isSha) throw new Error('需要打出【杀】响应决斗');
      target.hand.splice(cardIdx, 1);
      game.discardPile.push(card);
      this.addLog(game, `【${target.username}】打出了【杀】！轮到【${source.username}】出杀！`, 'PLAY');

      // Swap roles in duel
      game.pendingResponse = {
        type: 'DUEL_RESPONSE',
        sourcePlayerId: target.userId,
        targetPlayerId: source.userId,
        prompt: `【决斗进行中】对方打出了杀，请你打出一张【杀】，否则受到 1 点伤害！`,
        sourceCardName: '决斗',
        requiredCount: 1,
        providedCount: 0,
        timeoutSeconds: 20,
      };
      return;
    }

    if (pr.type === 'NANMAN_RESPONSE') {
      if (!isSha) throw new Error('需要打出【杀】响应南蛮入侵');
      target.hand.splice(cardIdx, 1);
      game.discardPile.push(card);
      this.addLog(game, `【${target.username}】打出了【杀】抵御了南蛮入侵！`, 'PLAY');
      game.pendingResponse = undefined;
      return;
    }

    if (pr.type === 'WANJIAN_RESPONSE') {
      if (!isShan) throw new Error('需要打出【闪】响应万箭齐发');
      target.hand.splice(cardIdx, 1);
      game.discardPile.push(card);
      this.addLog(game, `【${target.username}】打出了【闪】抵御了万箭齐发！`, 'PLAY');
      game.pendingResponse = undefined;
      return;
    }

    if (pr.type === 'DYING_RESCUE') {
      const isTao = card.subType === 'TAO';
      const isJiu = card.subType === 'JIU';
      if (!isTao && !isJiu) throw new Error('处于濒死状态，只能使用【桃】或【酒】自救');

      target.hand.splice(cardIdx, 1);
      game.discardPile.push(card);
      target.hp = Math.min(target.maxHp, target.hp + 1);
      this.addLog(
        game,
        `【${target.username}】使用了【${card.name}】进行自救，脱离濒死状态！（当前体力 ${target.hp}/${target.maxHp}）`,
        'HEAL'
      );

      if (target.hp > 0) {
        target.isDying = false;
        game.pendingResponse = undefined;
      }
      return;
    }
  }

  /**
   * Apply damage to target, triggering skills (Jianxiong, Fankui, Yiji, Ganglie, etc.) and dying checks
   */
  static applyDamage(
    game: ServerGameState,
    target: PlayerState,
    amount: number,
    source?: PlayerState,
    sourceCard?: Card,
    element: DamageElement = 'NORMAL'
  ) {
    target.hp -= amount;
    this.addLog(game, `【${target.username}】扣减 ${amount} 点体力（当前体力 ${target.hp}/${target.maxHp}）`, 'DAMAGE');

    // Trigger skills on damage:
    // Cao Cao 'jianxiong': gains damaging card
    if (target.hero.skills.some(s => s.id === 'jianxiong') && sourceCard) {
      target.hand.push(sourceCard);
      this.addLog(game, `【${target.username}】发动【奸雄】：获得了造成伤害的【${sourceCard.name}】！`, 'SKILL');
    }

    // Guo Jia 'yiji': draws 2 cards per 1 point damage
    if (target.hero.skills.some(s => s.id === 'yiji') && target.hp > 0) {
      this.addLog(game, `【${target.username}】发动【遗计】：受到伤害摸两张牌！`, 'SKILL');
      this.drawCards(game, target, 2 * amount);
    }

    // Sima Yi 'fankui': gains 1 card from source
    if (target.hero.skills.some(s => s.id === 'fankui') && source && target.hp > 0) {
      let card: Card | undefined;
      if (source.hand.length > 0) {
        card = source.hand.splice(Math.floor(Math.random() * source.hand.length), 1)[0];
      } else if (source.equipment.weapon) {
        card = source.equipment.weapon;
        source.equipment.weapon = undefined;
      }
      if (card) {
        target.hand.push(card);
        this.addLog(game, `【${target.username}】发动【反馈】：获得了【${source.username}】的一张牌【${card.name}】！`, 'SKILL');
      }
    }

    // Xiahou Dun 'ganglie'
    if (target.hero.skills.some(s => s.id === 'ganglie') && source && target.hp > 0) {
      const judge = this.drawJudgeCard(game);
      this.addLog(
        game,
        `【${target.username}】发动【刚烈】判定：【${judge.name}】(${getSuitSymbol(judge.suit)}${formatCardNumber(judge.number)})`,
        'SKILL'
      );
      game.discardPile.push(judge);
      if (judge.suit !== 'HEART') {
        if (source.hand.length > 0) {
          const c = source.hand.splice(0, 1)[0];
          game.discardPile.push(c);
          this.addLog(game, `【刚烈成功！】伤害来源【${source.username}】弃置了一张牌【${c.name}】！`, 'DAMAGE');
        } else {
          this.applyDamage(game, source, 1, target);
        }
      }
    }

    // Check dying state
    if (target.hp <= 0) {
      target.isDying = true;
      this.addLog(game, `🚨【${target.username}】进入濒死状态！正在等待自救救援……`, 'INFO');

      game.pendingResponse = {
        type: 'DYING_RESCUE',
        sourcePlayerId: source?.userId || target.userId,
        targetPlayerId: target.userId,
        prompt: `【濒死急救！】你当前体力为 ${target.hp}，请使用【桃】或【酒】自救，否则将阵亡！`,
        sourceCardName: '濒死自救',
        requiredCount: 1,
        providedCount: 0,
        timeoutSeconds: 20,
      };
    }
  }

  /**
   * Hero active skills (e.g. Zhiheng, Kurou, Qingnang, Rende, Guanxing)
   */
  static useSkill(
    game: ServerGameState,
    userId: string,
    skillId: string,
    cardIds?: string[]
  ) {
    if (game.status !== 'PLAYING') throw new Error('对局已结束');
    const player = this.getPlayer(game, userId);
    const opponent = this.getOpponent(game, userId);

    // Sun Quan 'zhiheng': discard any cards and draw equal amount
    if (skillId === 'zhiheng') {
      if (game.currentTurnPlayerId !== userId || game.phase !== 'PLAY') {
        throw new Error('只能在自己的出牌阶段发动【制衡】');
      }
      if (player.skillUsageCount['zhiheng']) {
        throw new Error('本回合已发动过【制衡】');
      }
      if (!cardIds || cardIds.length === 0) {
        throw new Error('请至少选择一张牌弃置');
      }

      const discardCount = cardIds.length;
      for (const cid of cardIds) {
        const idx = player.hand.findIndex(c => c.id === cid);
        if (idx !== -1) {
          const [c] = player.hand.splice(idx, 1);
          game.discardPile.push(c);
        }
      }

      player.skillUsageCount['zhiheng'] = 1;
      this.addLog(game, `【${player.username}】发动武将技【制衡】：弃置了 ${discardCount} 张牌并摸等量牌！`, 'SKILL');
      this.drawCards(game, player, discardCount);
      return;
    }

    // Huang Gai 'kurou': lose 1 HP, draw 2 cards
    if (skillId === 'kurou') {
      if (game.currentTurnPlayerId !== userId || game.phase !== 'PLAY') {
        throw new Error('只能在自己的出牌阶段发动【苦肉】');
      }
      if (player.hp <= 1) {
        throw new Error('体力过低，无法发动苦肉自残');
      }
      player.hp -= 1;
      this.addLog(game, `【${player.username}】发动【苦肉】：失去 1 点体力（剩余 ${player.hp}/${player.maxHp}），摸两张牌！`, 'SKILL');
      this.drawCards(game, player, 2);
      return;
    }

    // Hua Tuo 'qingnang': discard 1 hand card to heal 1 HP
    if (skillId === 'qingnang') {
      if (game.currentTurnPlayerId !== userId || game.phase !== 'PLAY') {
        throw new Error('只能在自己的出牌阶段发动【青囊】');
      }
      if (player.skillUsageCount['qingnang']) {
        throw new Error('本回合已发动过【青囊】');
      }
      if (player.hp >= player.maxHp) {
        throw new Error('体力已满，无需治疗');
      }
      if (!cardIds || cardIds.length !== 1) {
        throw new Error('请选择一张手牌弃置');
      }

      const idx = player.hand.findIndex(c => c.id === cardIds[0]);
      if (idx === -1) throw new Error('手牌不存在');
      const [c] = player.hand.splice(idx, 1);
      game.discardPile.push(c);

      player.skillUsageCount['qingnang'] = 1;
      player.hp += 1;
      this.addLog(game, `【${player.username}】发动【青囊】：弃置一张牌，回复 1 点体力（当前体力 ${player.hp}/${player.maxHp}）！`, 'SKILL');
      return;
    }

    // Liu Bei 'rende': give hand cards to opponent, heal 1 HP if 2+
    if (skillId === 'rende') {
      if (game.currentTurnPlayerId !== userId || game.phase !== 'PLAY') {
        throw new Error('只能在出牌阶段发动【仁德】');
      }
      if (!cardIds || cardIds.length === 0) {
        throw new Error('请选择要交出的手牌');
      }
      for (const cid of cardIds) {
        const idx = player.hand.findIndex(c => c.id === cid);
        if (idx !== -1) {
          const [c] = player.hand.splice(idx, 1);
          opponent.hand.push(c);
        }
      }
      const count = cardIds.length;
      player.skillUsageCount['rende'] = (player.skillUsageCount['rende'] || 0) + count;
      this.addLog(game, `【${player.username}】发动【仁德】：将 ${count} 张手牌交给了【${opponent.username}】！`, 'SKILL');
      if (player.skillUsageCount['rende'] >= 2 && player.hp < player.maxHp) {
        player.hp += 1;
        this.addLog(game, `【仁德仁心】本回合累计给出 2 张以上手牌，【${player.username}】回复 1 点体力！`, 'HEAL');
      }
      return;
    }

    // Zhen Ji 'luoshen'
    if (skillId === 'luoshen') {
      const judge = this.drawJudgeCard(game);
      const isBlack = isBlackCard(judge);
      this.addLog(
        game,
        `【${player.username}】发动【洛神】判定：【${judge.name}】(${getSuitSymbol(judge.suit)}${formatCardNumber(judge.number)}) - ${isBlack ? '【黑色成功！】获得该牌！' : '【红色终止】'}`,
        'SKILL'
      );
      if (isBlack) {
        player.hand.push(judge);
      } else {
        game.discardPile.push(judge);
      }
      return;
    }

    throw new Error(`未实现的技能发动：${skillId}`);
  }

  /**
   * End Play phase -> transition to Discard phase
   */
  static endPlayPhase(game: ServerGameState, userId: string) {
    if (game.currentTurnPlayerId !== userId) throw new Error('不是你的回合');
    if (game.phase !== 'PLAY') throw new Error('当前不是出牌阶段');

    const player = this.getPlayer(game, userId);
    const excess = calculateExcessCards(player);

    if (excess > 0) {
      game.phase = 'DISCARD';
      this.addLog(game, `【${player.username}】出牌阶段结束，当前手牌 ${player.hand.length} 张，体力 ${player.hp}，须弃置 ${excess} 张手牌。`, 'INFO');
    } else {
      this.addLog(game, `【${player.username}】出牌阶段结束，手牌数合法，无需弃牌。`, 'INFO');
      this.advanceToNextTurn(game);
    }
  }

  /**
   * Discard excess cards
   */
  static discardCards(game: ServerGameState, userId: string, cardIds: string[]) {
    if (game.currentTurnPlayerId !== userId) throw new Error('不是你的回合');
    if (game.phase !== 'DISCARD') throw new Error('当前不是弃牌阶段');

    const player = this.getPlayer(game, userId);
    const needed = calculateExcessCards(player);

    if (cardIds.length !== needed) {
      throw new Error(`弃牌数量不符，须准确弃置 ${needed} 张手牌（当前选择了 ${cardIds.length} 张）`);
    }

    for (const cid of cardIds) {
      const idx = player.hand.findIndex(c => c.id === cid);
      if (idx !== -1) {
        const [c] = player.hand.splice(idx, 1);
        game.discardPile.push(c);
      }
    }

    this.addLog(game, `【${player.username}】完成了弃牌（弃置 ${cardIds.length} 张牌）。`, 'INFO');

    // Lu Xun 'lianying': if hand becomes empty, draw 1 card
    if (player.hero.skills.some(s => s.id === 'lianying') && player.hand.length === 0) {
      this.addLog(game, `【${player.username}】失去最后一张手牌，触发【连营】：摸一张牌！`, 'SKILL');
      this.drawCards(game, player, 1);
    }

    this.advanceToNextTurn(game);
  }

  /**
   * Advance turn to next player
   */
  static advanceToNextTurn(game: ServerGameState) {
    const current = this.getPlayer(game, game.currentTurnPlayerId);
    const nextPlayer = this.getOpponent(game, game.currentTurnPlayerId);

    // End phase triggers: Diao Chan 'biyue' draws 1 card
    if (current.hero.skills.some(s => s.id === 'biyue')) {
      this.addLog(game, `【${current.username}】触发【闭月】：结束阶段摸一张牌！`, 'SKILL');
      this.drawCards(game, current, 1);
    }

    // Reset current turn buffs
    current.slashCountThisTurn = 0;
    current.drinkBuff = false;
    current.skillUsageCount = {};

    // Switch turn
    game.currentTurnPlayerId = nextPlayer.userId;
    game.turnNumber += 1;
    this.addLog(game, `════ 第 ${game.turnNumber} 回合：轮到【${nextPlayer.username}（${nextPlayer.hero.name}）】════`, 'INFO');

    // Check next player's Judge Area
    let skipDraw = false;
    let skipPlay = false;

    if (nextPlayer.judges.length > 0) {
      this.addLog(game, `【${nextPlayer.username}】判定阶段开始，正在结算判定区延时锦囊……`, 'JUDGE');
      while (nextPlayer.judges.length > 0) {
        const judgeCard = nextPlayer.judges.shift()!;
        const check = this.drawJudgeCard(game);
        const suitStr = `${getSuitSymbol(check.suit)}${formatCardNumber(check.number)}`;
        game.discardPile.push(check);

        if (judgeCard.subType === 'LE_BU_SI_SHU') {
          if (check.suit !== 'HEART') {
            skipPlay = true;
            this.addLog(game, `【乐不思蜀生效！】判定为 ${suitStr}（非红桃），跳过出牌阶段！`, 'JUDGE');
          } else {
            this.addLog(game, `【乐不思蜀失效！】判定为 ${suitStr}（红桃天命），逃过一劫！`, 'JUDGE');
          }
        } else if (judgeCard.subType === 'BING_LIANG_CUN_DUAN') {
          if (check.suit !== 'CLUB') {
            skipDraw = true;
            this.addLog(game, `【兵粮寸断生效！】判定为 ${suitStr}（非梅花），跳过摸牌阶段！`, 'JUDGE');
          } else {
            this.addLog(game, `【兵粮寸断失效！】判定为 ${suitStr}（梅花化解），正常摸牌！`, 'JUDGE');
          }
        } else if (judgeCard.subType === 'SHAN_DIAN') {
          if (check.suit === 'SPADE' && check.number >= 2 && check.number <= 9) {
            this.addLog(game, `⚡⚡⚡【天谴！闪电劈中！】判定为 ${suitStr}，【${nextPlayer.username}】受到 3 点雷电伤害！`, 'DAMAGE');
            this.applyDamage(game, nextPlayer, 3, undefined, undefined, 'THUNDER');
          } else {
            this.addLog(game, `【闪电未劈中】判定为 ${suitStr}，闪电移入对手判定区！`, 'JUDGE');
            current.judges.push(judgeCard);
          }
        }
      }
    }

    // Draw phase
    if (!skipDraw && game.status === 'PLAYING') {
      let drawCount = 2;
      // Zhou Yu 'yingzi': draws 3 cards
      if (nextPlayer.hero.skills.some(s => s.id === 'yingzi')) {
        drawCount = 3;
        this.addLog(game, `【${nextPlayer.username}】触发【英姿】：摸牌阶段摸 3 张牌！`, 'SKILL');
      }
      this.drawCards(game, nextPlayer, drawCount);
      this.addLog(game, `【${nextPlayer.username}】摸了 ${drawCount} 张牌。`, 'INFO');
    }

    // Play phase
    if (skipPlay && game.status === 'PLAYING') {
      this.addLog(game, `【${nextPlayer.username}】出牌阶段被跳过，直接进入弃牌阶段。`, 'INFO');
      const excess = calculateExcessCards(nextPlayer);
      if (excess > 0) {
        game.phase = 'DISCARD';
      } else {
        this.advanceToNextTurn(game);
      }
    } else {
      game.phase = 'PLAY';
    }
  }

  /**
   * Player surrenders
   */
  static surrender(game: ServerGameState, userId: string) {
    if (game.status !== 'PLAYING') throw new Error('对局已结束');
    const player = this.getPlayer(game, userId);
    const opponent = this.getOpponent(game, userId);

    player.surrendered = true;
    game.status = 'ENDED';
    game.winnerId = opponent.userId;
    game.endReason = `【${player.username}（${player.hero.name}）】主动投降认输！【${opponent.username}（${opponent.hero.name}）】取得胜利！`;
    this.addLog(game, game.endReason, 'INFO');
  }

  /**
   * Sanitize game state for a specific client to ensure absolute hand privacy!
   */
  static sanitizeForPlayer(game: ServerGameState, forUserId: string): ClientGameState {
    const myPlayer = game.players.find(p => p.userId === forUserId);
    const opp = game.players.find(p => p.userId !== forUserId);

    if (!myPlayer || !opp) {
      throw new Error('无效的玩家查询');
    }

    // Public opponent state: NEVER send opp.hand contents!
    const opponentPlayer: PublicPlayerState = {
      userId: opp.userId,
      username: opp.username,
      avatar: opp.avatar,
      hero: opp.hero,
      hp: opp.hp,
      maxHp: opp.maxHp,
      handCount: opp.hand.length,
      equipment: opp.equipment,
      judges: opp.judges,
      isDying: opp.isDying,
      drinkBuff: opp.drinkBuff,
      slashCountThisTurn: opp.slashCountThisTurn,
      chained: opp.chained,
      online: opp.online,
      ready: opp.ready,
      surrendered: opp.surrendered,
    };

    return {
      gameId: game.gameId,
      roomId: game.roomId,
      myPlayer,
      opponentPlayer,
      currentTurnPlayerId: game.currentTurnPlayerId,
      isMyTurn: game.currentTurnPlayerId === forUserId,
      phase: game.phase,
      turnNumber: game.turnNumber,
      drawDeckCount: game.drawDeck.length,
      discardPileTop: game.discardPile[game.discardPile.length - 1],
      discardPileCount: game.discardPile.length,
      pendingResponse: game.pendingResponse,
      lastPlayedCard: game.lastPlayedCard,
      eventLogs: game.eventLogs,
      status: game.status,
      winnerId: game.winnerId,
      endReason: game.endReason,
    };
  }
}
