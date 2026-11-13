import { Card, DamageElement, PlayerState } from './types';

/**
 * Check if a card is red (Heart or Diamond)
 */
export function isRedCard(card: Card): boolean {
  return card.suit === 'HEART' || card.suit === 'DIAMOND';
}

/**
 * Check if a card is black (Spade or Club)
 */
export function isBlackCard(card: Card): boolean {
  return card.suit === 'SPADE' || card.suit === 'CLUB';
}

/**
 * Format card rank number to standard Poker notation
 */
export function formatCardNumber(num: number): string {
  if (num === 1) return 'A';
  if (num === 11) return 'J';
  if (num === 12) return 'Q';
  if (num === 13) return 'K';
  return String(num);
}

/**
 * Get display symbol for suit
 */
export function getSuitSymbol(suit: Card['suit']): string {
  switch (suit) {
    case 'SPADE': return '♠';
    case 'HEART': return '♥';
    case 'CLUB': return '♣';
    case 'DIAMOND': return '♦';
  }
}

/**
 * Calculate player attack range based on equipped weapon
 */
export function getAttackRange(player: PlayerState): number {
  if (player.equipment.weapon?.range) {
    return player.equipment.weapon.range;
  }
  return 1;
}

/**
 * Calculate distance from source player to target player in 2-player match
 */
export function calculateDistance(source: PlayerState, target: PlayerState): number {
  let dist = 1; // 2 players base distance

  // Target defensive horse (+1)
  if (target.equipment.defHorse) {
    dist += 1;
  }

  // Source offensive horse (-1)
  if (source.equipment.offHorse) {
    dist -= 1;
  }

  // Ma Chao 'mashu' skill (-1)
  if (source.hero.skills.some(s => s.id === 'mashu')) {
    dist -= 1;
  }

  return Math.max(1, dist);
}

/**
 * Check if source player can attack target with Sha
 */
export function canShaTarget(source: PlayerState, target: PlayerState): { allowed: boolean; reason?: string } {
  // Check Zhuge Liang Kongcheng: cannot be target of Sha or Duel when hand is empty
  const hasKongcheng = target.hero.skills.some(s => s.id === 'kongcheng');
  if (hasKongcheng && target.hand.length === 0) {
    return { allowed: false, reason: '目标处于【空城】状态，不能成为【杀】的目标' };
  }

  // Check attack range vs distance
  const range = getAttackRange(source);
  const distance = calculateDistance(source, target);
  if (range < distance) {
    return { allowed: false, reason: `攻击距离不足（距离 ${distance}，当前攻击范围 ${range}）` };
  }

  // Check Sha usage limit
  const isPaoxiao = source.hero.skills.some(s => s.id === 'paoxiao');
  const isZhugeLiannu = source.equipment.weapon?.name === '诸葛连弩';
  if (!isPaoxiao && !isZhugeLiannu && source.slashCountThisTurn >= 1) {
    return { allowed: false, reason: '本回合出【杀】次数已达上限（需要诸葛连弩或咆哮技能）' };
  }

  return { allowed: true };
}

/**
 * Check how many cards a player must discard at discard phase
 */
export function calculateExcessCards(player: PlayerState): number {
  // Lu Meng 'keji': if no Sha played this turn, skips discard!
  const hasKeji = player.hero.skills.some(s => s.id === 'keji');
  if (hasKeji && player.slashCountThisTurn === 0) {
    return 0;
  }

  const limit = Math.max(0, player.hp);
  return Math.max(0, player.hand.length - limit);
}

/**
 * Calculate final damage after armor and buffs
 */
export function resolveDamage(
  source: PlayerState | undefined,
  target: PlayerState,
  baseDamage: number,
  element: DamageElement = 'NORMAL',
  card?: Card
): { finalDamage: number; blocked: boolean; reason?: string } {
  // Check armor resistance
  const armor = target.equipment.armor;
  const ignoresArmor = source?.equipment.weapon?.name === '青釭剑';

  if (armor && !ignoresArmor) {
    // 仁王盾: Renwang Shield blocks black Sha
    if (armor.name === '仁王盾' && card && card.subType === 'SHA' && isBlackCard(card)) {
      return { finalDamage: 0, blocked: true, reason: '目标装备【仁王盾】，黑【杀】无效' };
    }

    // 藤甲: Vine armor blocks normal Sha, Nanman, Wanjian
    if (armor.name === '藤甲') {
      if (card && card.subType === 'SHA' && element === 'NORMAL') {
        return { finalDamage: 0, blocked: true, reason: '目标装备【藤甲】，普通【杀】无效' };
      }
      if (card && (card.subType === 'NAN_MAN_RU_QIN' || card.subType === 'WAN_JIAN_QI_FA')) {
        return { finalDamage: 0, blocked: true, reason: '目标装备【藤甲】，【南蛮入侵】与【万箭齐发】对其无效' };
      }
    }
  }

  let damage = baseDamage;

  // Wine / Jiu buff on Sha
  if (source && source.drinkBuff && card?.subType === 'SHA') {
    damage += 1;
  }

  // Vine armor vulnerability to Fire
  if (armor && !ignoresArmor && armor.name === '藤甲' && element === 'FIRE') {
    damage += 1;
  }

  // 白银狮子: Silver lion caps damage to 1
  if (armor && !ignoresArmor && armor.name === '白银狮子' && damage > 1) {
    damage = 1;
  }

  return { finalDamage: damage, blocked: false };
}
