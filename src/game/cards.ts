import { Card, Suit } from './types';

export function createStandardDeck(): Card[] {
  let seq = 1;
  const cards: Card[] = [];

  const add = (
    name: string,
    type: Card['type'],
    subType: Card['subType'],
    suit: Suit,
    number: number,
    description: string,
    extra?: Partial<Card>
  ) => {
    cards.push({
      id: `card_${seq++}`,
      name,
      type,
      subType,
      suit,
      number,
      description,
      ...extra,
    });
  };

  // --- 基本牌 BASIC ---

  // 【杀】普通杀
  const normalShaData: [Suit, number][] = [
    ['SPADE', 7], ['SPADE', 8], ['SPADE', 8], ['SPADE', 9], ['SPADE', 9], ['SPADE', 10], ['SPADE', 10],
    ['HEART', 10], ['HEART', 10], ['HEART', 11],
    ['CLUB', 2], ['CLUB', 3], ['CLUB', 4], ['CLUB', 5], ['CLUB', 6], ['CLUB', 7], ['CLUB', 8], ['CLUB', 8], ['CLUB', 9], ['CLUB', 9], ['CLUB', 10], ['CLUB', 10], ['CLUB', 11], ['CLUB', 11],
    ['DIAMOND', 6], ['DIAMOND', 7], ['DIAMOND', 8], ['DIAMOND', 9], ['DIAMOND', 10], ['DIAMOND', 13],
  ];
  normalShaData.forEach(([suit, num]) => {
    add('杀', 'BASIC', 'SHA', suit, num, '出牌阶段对攻击距离内的角色使用，目标须打出一张【闪】，否则受到1点伤害。', {
      element: 'NORMAL',
    });
  });

  // 【雷杀】
  const thunderShaData: [Suit, number][] = [
    ['SPADE', 4], ['SPADE', 5], ['SPADE', 6], ['CLUB', 5], ['CLUB', 6], ['CLUB', 7], ['CLUB', 8],
  ];
  thunderShaData.forEach(([suit, num]) => {
    add('雷杀', 'BASIC', 'SHA', suit, num, '雷属性杀，若目标不出【闪】则受到1点雷电伤害。可触发铁索连环。', {
      element: 'THUNDER',
    });
  });

  // 【火杀】
  const fireShaData: [Suit, number][] = [
    ['HEART', 2], ['HEART', 3], ['HEART', 4], ['DIAMOND', 4], ['DIAMOND', 5],
  ];
  fireShaData.forEach(([suit, num]) => {
    add('火杀', 'BASIC', 'SHA', suit, num, '火属性杀，若目标不出【闪】则受到1点火焰伤害。对藤甲伤害+1。', {
      element: 'FIRE',
    });
  });

  // 【闪】
  const shanData: [Suit, number][] = [
    ['HEART', 2], ['HEART', 2], ['HEART', 8], ['HEART', 9], ['HEART', 11], ['HEART', 12], ['HEART', 13],
    ['DIAMOND', 2], ['DIAMOND', 2], ['DIAMOND', 3], ['DIAMOND', 4], ['DIAMOND', 5], ['DIAMOND', 6], ['DIAMOND', 7], ['DIAMOND', 8], ['DIAMOND', 9], ['DIAMOND', 10], ['DIAMOND', 11], ['DIAMOND', 11],
  ];
  shanData.forEach(([suit, num]) => {
    add('闪', 'BASIC', 'SHAN', suit, num, '抵消一张【杀】或【万箭齐发】的效果。');
  });

  // 【桃】
  const taoData: [Suit, number][] = [
    ['HEART', 3], ['HEART', 4], ['HEART', 5], ['HEART', 6], ['HEART', 6], ['HEART', 7], ['HEART', 8], ['HEART', 9], ['HEART', 12],
    ['DIAMOND', 2], ['DIAMOND', 3], ['DIAMOND', 12],
  ];
  taoData.forEach(([suit, num]) => {
    add('桃', 'BASIC', 'TAO', suit, num, '出牌阶段使用回复1点体力，或在濒死时使用回复1点体力。');
  });

  // 【酒】
  const jiuData: [Suit, number][] = [
    ['SPADE', 3], ['SPADE', 9], ['CLUB', 3], ['CLUB', 9], ['DIAMOND', 9],
  ];
  jiuData.forEach(([suit, num]) => {
    add('酒', 'BASIC', 'JIU', suit, num, '出牌阶段使用，本回合你下一张【杀】伤害+1；或在濒死时使用自救回复1点体力。');
  });

  // --- 锦囊牌 TRICK ---

  // 【决斗】
  const duelData: [Suit, number][] = [
    ['SPADE', 1], ['CLUB', 1], ['DIAMOND', 1],
  ];
  duelData.forEach(([suit, num]) => {
    add('决斗', 'TRICK', 'JUE_DOU', suit, num, '出牌阶段对对手使用。由对手先出【杀】，双方轮流出【杀】，首先不出【杀】者受1点伤害。');
  });

  // 【过河拆桥】
  const chaiData: [Suit, number][] = [
    ['SPADE', 3], ['SPADE', 4], ['SPADE', 12], ['CLUB', 3], ['CLUB', 4], ['HEART', 12],
  ];
  chaiData.forEach(([suit, num]) => {
    add('过河拆桥', 'TRICK', 'GUO_HE_CHAI_QIAO', suit, num, '出牌阶段对对手使用，弃置其装备区或手牌区的一张牌。');
  });

  // 【顺手牵羊】
  const shunData: [Suit, number][] = [
    ['SPADE', 3], ['SPADE', 4], ['SPADE', 11], ['DIAMOND', 3], ['DIAMOND', 4],
  ];
  shunData.forEach(([suit, num]) => {
    add('顺手牵羊', 'TRICK', 'SHUN_SHOU_QIAN_YANG', suit, num, '出牌阶段对距离为1的对手使用，获得其手牌或装备区的一张牌。', {
      range: 1,
    });
  });

  // 【无中生有】
  const wuzhongData: [Suit, number][] = [
    ['HEART', 7], ['HEART', 8], ['HEART', 9], ['HEART', 11],
  ];
  wuzhongData.forEach(([suit, num]) => {
    add('无中生有', 'TRICK', 'WU_ZHONG_SHENG_YOU', suit, num, '出牌阶段对自己使用，摸两张牌。');
  });

  // 【无懈可击】
  const wuxieData: [Suit, number][] = [
    ['SPADE', 11], ['CLUB', 12], ['CLUB', 13], ['HEART', 1], ['HEART', 13], ['DIAMOND', 12],
  ];
  wuxieData.forEach(([suit, num]) => {
    add('无懈可击', 'TRICK', 'WU_XIE_KE_JI', suit, num, '当一张锦囊牌生效前使用，抵消其效果。');
  });

  // 【南蛮入侵】
  const nanmanData: [Suit, number][] = [
    ['SPADE', 7], ['SPADE', 13], ['CLUB', 7],
  ];
  nanmanData.forEach(([suit, num]) => {
    add('南蛮入侵', 'TRICK', 'NAN_MAN_RU_QIN', suit, num, '对手须打出一张【杀】，否则受到1点伤害。');
  });

  // 【万箭齐发】
  add('万箭齐发', 'TRICK', 'WAN_JIAN_QI_FA', 'HEART', 1, '对手须打出一张【闪】，否则受到1点伤害。');

  // 【桃园结义】
  add('桃园结义', 'TRICK', 'TAO_YUAN_JIE_YI', 'HEART', 1, '所有受伤角色各回复1点体力。');

  // 【五谷丰登】
  add('五谷丰登', 'TRICK', 'WU_GU_FENG_DENG', 'HEART', 3, '亮出牌堆顶两张牌，双方依次选择获得一张。');
  add('五谷丰登', 'TRICK', 'WU_GU_FENG_DENG', 'HEART', 4, '亮出牌堆顶两张牌，双方依次选择获得一张。');

  // 【火攻】
  add('火攻', 'TRICK', 'HUO_GONG', 'HEART', 2, '展示对手一张手牌，若你弃置一张同花色手牌，对其造成1点火焰伤害。');
  add('火攻', 'TRICK', 'HUO_GONG', 'HEART', 3, '展示对手一张手牌，若你弃置一张同花色手牌，对其造成1点火焰伤害。');
  add('火攻', 'TRICK', 'HUO_GONG', 'DIAMOND', 12, '展示对手一张手牌，若你弃置一张同花色手牌，对其造成1点火焰伤害。');

  // 【铁索连环】
  add('铁索连环', 'TRICK', 'TIE_SUO_LIAN_HUAN', 'SPADE', 11, '将角色重置连环状态，或重铸此牌。');
  add('铁索连环', 'TRICK', 'TIE_SUO_LIAN_HUAN', 'SPADE', 12, '将角色重置连环状态，或重铸此牌。');
  add('铁索连环', 'TRICK', 'TIE_SUO_LIAN_HUAN', 'CLUB', 10, '将角色重置连环状态，或重铸此牌。');
  add('铁索连环', 'TRICK', 'TIE_SUO_LIAN_HUAN', 'CLUB', 11, '将角色重置连环状态，或重铸此牌。');

  // 【乐不思蜀】延时锦囊
  add('乐不思蜀', 'TRICK', 'LE_BU_SI_SHU', 'SPADE', 6, '置于目标判定区。判定阶段判定：若不为红桃，跳过其出牌阶段。', { isDelayedTrick: true });
  add('乐不思蜀', 'TRICK', 'LE_BU_SI_SHU', 'CLUB', 6, '置于目标判定区。判定阶段判定：若不为红桃，跳过其出牌阶段。', { isDelayedTrick: true });
  add('乐不思蜀', 'TRICK', 'LE_BU_SI_SHU', 'HEART', 6, '置于目标判定区。判定阶段判定：若不为红桃，跳过其出牌阶段。', { isDelayedTrick: true });

  // 【兵粮寸断】延时锦囊
  add('兵粮寸断', 'TRICK', 'BING_LIANG_CUN_DUAN', 'SPADE', 10, '置于距离为1的对手判定区。判定阶段判定：若不为梅花，跳过其摸牌阶段。', { isDelayedTrick: true, range: 1 });
  add('兵粮寸断', 'TRICK', 'BING_LIANG_CUN_DUAN', 'CLUB', 4, '置于距离为1的对手判定区。判定阶段判定：若不为梅花，跳过其摸牌阶段。', { isDelayedTrick: true, range: 1 });

  // 【闪电】延时锦囊
  add('闪电', 'TRICK', 'SHAN_DIAN', 'SPADE', 1, '置于自己判定区。判定阶段判定：若为黑桃2~9，受3点雷电伤害；否则移至对手判定区。', { isDelayedTrick: true });
  add('闪电', 'TRICK', 'SHAN_DIAN', 'HEART', 12, '置于自己判定区。判定阶段判定：若为黑桃2~9，受3点雷电伤害；否则移至对手判定区。', { isDelayedTrick: true });

  // --- 装备牌 EQUIPMENT ---

  // 武器
  add('诸葛连弩', 'EQUIPMENT', 'WEAPON', 'CLUB', 1, '【攻击距离: 1】锁定技，出牌阶段你使用【杀】无次数限制。', { range: 1 });
  add('诸葛连弩', 'EQUIPMENT', 'WEAPON', 'DIAMOND', 1, '【攻击距离: 1】锁定技，出牌阶段你使用【杀】无次数限制。', { range: 1 });
  add('青釭剑', 'EQUIPMENT', 'WEAPON', 'SPADE', 6, '【攻击距离: 2】锁定技，每当你使用【杀】指定目标后，无视其防具。', { range: 2 });
  add('雌雄双股剑', 'EQUIPMENT', 'WEAPON', 'SPADE', 2, '【攻击距离: 2】你使用【杀】指定异性角色后，对方须弃一张手牌或令你摸一张牌。', { range: 2 });
  add('寒冰剑', 'EQUIPMENT', 'WEAPON', 'SPADE', 2, '【攻击距离: 2】每当你使用【杀】对目标造成伤害时，你可以防止此伤害，改为依次弃置其两张牌。', { range: 2 });
  add('古锭刀', 'EQUIPMENT', 'WEAPON', 'SPADE', 1, '【攻击距离: 2】锁定技，当你使用【杀】对没有手牌的角色造成伤害时，伤害+1。', { range: 2 });
  add('贯石斧', 'EQUIPMENT', 'WEAPON', 'DIAMOND', 5, '【攻击距离: 3】目标使用【闪】抵消你使用的【杀】后，你可以弃置两张牌，令此【杀】依然造成伤害。', { range: 3 });
  add('青龙偃月刀', 'EQUIPMENT', 'WEAPON', 'SPADE', 5, '【攻击距离: 3】当你使用的【杀】被【闪】抵消后，你可以对其立即再使用一张【杀】。', { range: 3 });
  add('丈八蛇矛', 'EQUIPMENT', 'WEAPON', 'SPADE', 12, '【攻击距离: 3】你可以将两张手牌当【杀】使用或打出。', { range: 3 });
  add('方天画戟', 'EQUIPMENT', 'WEAPON', 'DIAMOND', 12, '【攻击距离: 4】当你使用的【杀】是你最后一张手牌时，伤害更为强力。', { range: 4 });
  add('麒麟弓', 'EQUIPMENT', 'WEAPON', 'HEART', 5, '【攻击距离: 5】当你使用【杀】造成伤害时，可弃置其装备区的一匹坐骑。', { range: 5 });
  add('朱雀羽扇', 'EQUIPMENT', 'WEAPON', 'DIAMOND', 1, '【攻击距离: 4】你可以将普通【杀】当作【火杀】使用。', { range: 4 });

  // 防具
  add('八卦阵', 'EQUIPMENT', 'ARMOR', 'SPADE', 2, '每当你需要使用或打出【闪】时，你可以进行判定：若判定结果为红色，视为你使用或打出了一张【闪】。');
  add('八卦阵', 'EQUIPMENT', 'ARMOR', 'CLUB', 2, '每当你需要使用或打出【闪】时，你可以进行判定：若判定结果为红色，视为你使用或打出了一张【闪】。');
  add('仁王盾', 'EQUIPMENT', 'ARMOR', 'CLUB', 2, '锁定技，黑色的【杀】对你无效。');
  add('藤甲', 'EQUIPMENT', 'ARMOR', 'SPADE', 2, '锁定技，普通【杀】、【南蛮入侵】和【万箭齐发】对你无效；你受到的火焰伤害+1。');
  add('白银狮子', 'EQUIPMENT', 'ARMOR', 'CLUB', 1, '锁定技，你每次受到伤害的上限为1；当你失去此装备时，你回复1点体力。');

  // 坐骑
  // 进攻马 (-1马)
  add('赤兔', 'EQUIPMENT', 'OFFENSIVE_HORSE', 'HEART', 5, '【进攻马】锁定技，你计算与其他角色的距离-1。', { distanceMod: -1 });
  add('大宛', 'EQUIPMENT', 'OFFENSIVE_HORSE', 'SPADE', 13, '【进攻马】锁定技，你计算与其他角色的距离-1。', { distanceMod: -1 });
  add('紫骍', 'EQUIPMENT', 'OFFENSIVE_HORSE', 'DIAMOND', 13, '【进攻马】锁定技，你计算与其他角色的距离-1。', { distanceMod: -1 });

  // 防御马 (+1马)
  add('的卢', 'EQUIPMENT', 'DEFENSIVE_HORSE', 'CLUB', 5, '【防御马】锁定技，其他角色计算与你的距离+1。', { distanceMod: 1 });
  add('绝影', 'EQUIPMENT', 'DEFENSIVE_HORSE', 'SPADE', 5, '【防御马】锁定技，其他角色计算与你的距离+1。', { distanceMod: 1 });
  add('爪黄飞电', 'EQUIPMENT', 'DEFENSIVE_HORSE', 'HEART', 13, '【防御马】锁定技，其他角色计算与你的距离+1。', { distanceMod: 1 });

  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
