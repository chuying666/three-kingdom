import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  canShaTarget,
  calculateExcessCards,
  resolveDamage,
  isRedCard,
  isBlackCard,
  formatCardNumber,
} from './rules';
import { PlayerState, Card, Hero } from './types';

function createMockHero(id: string, name: string, skills: Hero['skills'] = []): Hero {
  return {
    id,
    name,
    title: '称号',
    faction: 'WEI',
    gender: 'MALE',
    maxHp: 4,
    initialHp: 4,
    avatar: '⚔️',
    quote: '决战！',
    skills,
  };
}

function createMockPlayer(id: string, hp: number, hero: Hero): PlayerState {
  return {
    userId: id,
    username: id,
    avatar: '⚔️',
    hero,
    hp,
    maxHp: hero.maxHp,
    hand: [],
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
}

const mockCard: Card = {
  id: 'c1',
  name: '杀',
  type: 'BASIC',
  subType: 'SHA',
  suit: 'SPADE',
  number: 7,
  description: '杀',
  element: 'NORMAL',
};

test('card suit color identification', () => {
  const heartCard: Card = { ...mockCard, suit: 'HEART' };
  const diamondCard: Card = { ...mockCard, suit: 'DIAMOND' };
  const spadeCard: Card = { ...mockCard, suit: 'SPADE' };
  const clubCard: Card = { ...mockCard, suit: 'CLUB' };

  assert.equal(isRedCard(heartCard), true);
  assert.equal(isRedCard(diamondCard), true);
  assert.equal(isRedCard(spadeCard), false);
  assert.equal(isBlackCard(spadeCard), true);
  assert.equal(isBlackCard(clubCard), true);
});

test('card number formatting', () => {
  assert.equal(formatCardNumber(1), 'A');
  assert.equal(formatCardNumber(10), '10');
  assert.equal(formatCardNumber(11), 'J');
  assert.equal(formatCardNumber(12), 'Q');
  assert.equal(formatCardNumber(13), 'K');
});

test('distance calculation with horses and skills', () => {
  const p1 = createMockPlayer('p1', 4, createMockHero('caocao', '曹操'));
  const p2 = createMockPlayer('p2', 4, createMockHero('liubei', '刘备'));

  // Base distance
  assert.equal(calculateDistance(p1, p2), 1);

  // Target equipped +1 defensive horse
  p2.equipment.defHorse = {
    id: 'def_horse',
    name: '绝影',
    type: 'EQUIPMENT',
    subType: 'DEFENSIVE_HORSE',
    suit: 'SPADE',
    number: 5,
    description: '+1马',
    distanceMod: 1,
  };
  assert.equal(calculateDistance(p1, p2), 2);

  // Source equipped -1 offensive horse
  p1.equipment.offHorse = {
    id: 'off_horse',
    name: '赤兔',
    type: 'EQUIPMENT',
    subType: 'OFFENSIVE_HORSE',
    suit: 'HEART',
    number: 5,
    description: '-1马',
    distanceMod: -1,
  };
  assert.equal(calculateDistance(p1, p2), 1);

  // Ma Chao with mashu skill calculates distance -1
  const machao = createMockPlayer('p3', 4, createMockHero('machao', '马超', [
    { id: 'mashu', name: '马术', type: 'LOCKED', description: '距离-1' },
  ]));
  assert.equal(calculateDistance(machao, p2), 1); // target has defHorse (+1), base 1, mashu -1 => clamped to min 1
});

test('Kongcheng prevents Sha target when empty hand', () => {
  const p1 = createMockPlayer('p1', 4, createMockHero('caocao', '曹操'));
  const zhuge = createMockPlayer('p2', 3, createMockHero('zhugeliang', '诸葛亮', [
    { id: 'kongcheng', name: '空城', type: 'LOCKED', description: '无手牌不能成为杀或决斗目标' },
  ]));

  // Empty hand
  zhuge.hand = [];
  const checkEmpty = canShaTarget(p1, zhuge);
  assert.equal(checkEmpty.allowed, false);

  // With hand card
  zhuge.hand = [mockCard];
  const checkWithHand = canShaTarget(p1, zhuge);
  assert.equal(checkWithHand.allowed, true);
});

test('Sha play limit logic for Paoxiao vs standard general', () => {
  const normal = createMockPlayer('p1', 4, createMockHero('caocao', '曹操'));
  const target = createMockPlayer('p2', 4, createMockHero('liubei', '刘备'));

  normal.slashCountThisTurn = 1;
  assert.equal(canShaTarget(normal, target).allowed, false);

  // Zhang Fei has Paoxiao
  const zhangfei = createMockPlayer('p3', 4, createMockHero('zhangfei', '张飞', [
    { id: 'paoxiao', name: '咆哮', type: 'LOCKED', description: '出杀无限制' },
  ]));
  zhangfei.slashCountThisTurn = 5;
  assert.equal(canShaTarget(zhangfei, target).allowed, true);
});

test('Armor resistance: Renwang Dun and Tengjia', () => {
  const p1 = createMockPlayer('p1', 4, createMockHero('caocao', '曹操'));
  const p2 = createMockPlayer('p2', 4, createMockHero('liubei', '刘备'));

  // Renwang Dun equipped
  p2.equipment.armor = {
    id: 'a1',
    name: '仁王盾',
    type: 'EQUIPMENT',
    subType: 'ARMOR',
    suit: 'CLUB',
    number: 2,
    description: '黑杀无效',
  };

  const blackSha: Card = { ...mockCard, suit: 'SPADE' };
  const redSha: Card = { ...mockCard, suit: 'HEART' };

  const blackRes = resolveDamage(p1, p2, 1, 'NORMAL', blackSha);
  assert.equal(blackRes.blocked, true);
  assert.equal(blackRes.finalDamage, 0);

  const redRes = resolveDamage(p1, p2, 1, 'NORMAL', redSha);
  assert.equal(redRes.blocked, false);
  assert.equal(redRes.finalDamage, 1);
});

test('Excess discard calculation and Lu Meng Keji', () => {
  const normal = createMockPlayer('p1', 2, createMockHero('caocao', '曹操'));
  normal.hand = [mockCard, mockCard, mockCard, mockCard]; // 4 cards, hp 2 => 2 excess
  assert.equal(calculateExcessCards(normal), 2);

  const lumeng = createMockPlayer('p2', 2, createMockHero('lumeng', '吕蒙', [
    { id: 'keji', name: '克己', type: 'TRIGGER', description: '不出杀跳过弃牌' },
  ]));
  lumeng.hand = [mockCard, mockCard, mockCard, mockCard];
  lumeng.slashCountThisTurn = 0;
  assert.equal(calculateExcessCards(lumeng), 0);

  lumeng.slashCountThisTurn = 1;
  assert.equal(calculateExcessCards(lumeng), 2);
});
