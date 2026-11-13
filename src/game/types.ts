export type Suit = 'SPADE' | 'HEART' | 'CLUB' | 'DIAMOND';

export type CardType = 'BASIC' | 'TRICK' | 'EQUIPMENT';

export type BasicSubType = 'SHA' | 'SHAN' | 'TAO' | 'JIU';

export type TrickSubType = 
  | 'JUE_DOU'
  | 'GUO_HE_CHAI_QIAO'
  | 'SHUN_SHOU_QIAN_YANG'
  | 'WU_ZHONG_SHENG_YOU'
  | 'WU_XIE_KE_JI'
  | 'NAN_MAN_RU_QIN'
  | 'WAN_JIAN_QI_FA'
  | 'TAO_YUAN_JIE_YI'
  | 'WU_GU_FENG_DENG'
  | 'HUO_GONG'
  | 'JIE_DAO_SHA_REN'
  | 'TIE_SUO_LIAN_HUAN'
  | 'LE_BU_SI_SHU'
  | 'BING_LIANG_CUN_DUAN'
  | 'SHAN_DIAN';

export type EquipmentSubType = 
  | 'WEAPON'
  | 'ARMOR'
  | 'OFFENSIVE_HORSE'
  | 'DEFENSIVE_HORSE';

export type DamageElement = 'NORMAL' | 'FIRE' | 'THUNDER';

export type Faction = 'WEI' | 'SHU' | 'WU' | 'QUN';

export type Gender = 'MALE' | 'FEMALE';

export type GamePhase = 
  | 'START'
  | 'JUDGE'
  | 'DRAW'
  | 'PLAY'
  | 'DISCARD'
  | 'END';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  subType: BasicSubType | TrickSubType | EquipmentSubType;
  suit: Suit;
  number: number; // 1 (A) to 13 (K)
  description: string;
  range?: number; // For weapons: range
  distanceMod?: number; // For horses: -1 or +1
  element?: DamageElement; // For Sha: normal, fire, thunder
  isDelayedTrick?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  type: 'ACTIVE' | 'PASSIVE' | 'LOCKED' | 'TRIGGER' | 'CONVERT';
  description: string;
  usablePhase?: GamePhase[];
  limitPerTurn?: number;
}

export interface Hero {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  gender: Gender;
  maxHp: number;
  initialHp: number;
  skills: Skill[];
  avatar: string;
  quote: string;
}

export interface EquipmentArea {
  weapon?: Card;
  armor?: Card;
  offHorse?: Card; // -1 horse
  defHorse?: Card; // +1 horse
}

export interface PendingResponse {
  type: 
    | 'SHA_RESPONSE' 
    | 'DUEL_RESPONSE' 
    | 'NANMAN_RESPONSE' 
    | 'WANJIAN_RESPONSE' 
    | 'WUXIE_RESPONSE' 
    | 'DYING_RESCUE' 
    | 'BAGUA_DECISION' 
    | 'GUICAI_DECISION' 
    | 'CHOOSE_CARD_TARGET';
  sourcePlayerId: string;
  targetPlayerId: string;
  card?: Card;
  requiredCardType?: string;
  prompt: string;
  sourceCardName: string;
  requiredCount: number;
  providedCount: number;
  timeoutSeconds: number;
  metadata?: Record<string, any>;
}

export interface PlayerState {
  userId: string;
  username: string;
  avatar: string;
  hero: Hero;
  hp: number;
  maxHp: number;
  hand: Card[];
  equipment: EquipmentArea;
  judges: Card[];
  isDying: boolean;
  drinkBuff: boolean; // Drank wine for +1 Sha dmg
  slashCountThisTurn: number;
  chained: boolean; // Iron chain
  skillUsageCount: Record<string, number>;
  online: boolean;
  ready: boolean;
  surrendered: boolean;
}

export interface PublicPlayerState {
  userId: string;
  username: string;
  avatar: string;
  hero: Hero;
  hp: number;
  maxHp: number;
  handCount: number;
  equipment: EquipmentArea;
  judges: Card[];
  isDying: boolean;
  drinkBuff: boolean;
  slashCountThisTurn: number;
  chained: boolean;
  online: boolean;
  ready: boolean;
  surrendered: boolean;
}

export interface GameEventLog {
  id: string;
  timestamp: number;
  text: string;
  type: 'INFO' | 'PLAY' | 'DAMAGE' | 'HEAL' | 'SKILL' | 'JUDGE' | 'EQUIP';
}

export interface ServerGameState {
  gameId: string;
  roomId: string;
  players: [PlayerState, PlayerState];
  currentTurnPlayerId: string;
  phase: GamePhase;
  turnNumber: number;
  drawDeck: Card[];
  discardPile: Card[];
  pendingResponse?: PendingResponse;
  lastPlayedCard?: Card;
  eventLogs: GameEventLog[];
  status: 'PLAYING' | 'ENDED';
  winnerId?: string;
  endReason?: string;
  createdAt: number;
}

export interface ClientGameState {
  gameId: string;
  roomId: string;
  myPlayer: PlayerState;
  opponentPlayer: PublicPlayerState;
  currentTurnPlayerId: string;
  isMyTurn: boolean;
  phase: GamePhase;
  turnNumber: number;
  drawDeckCount: number;
  discardPileTop?: Card;
  discardPileCount: number;
  pendingResponse?: PendingResponse;
  lastPlayedCard?: Card;
  eventLogs: GameEventLog[];
  status: 'PLAYING' | 'ENDED';
  winnerId?: string;
  endReason?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isEmoji?: boolean;
}

export interface Room {
  roomId: string;
  roomCode: string;
  hostId: string;
  players: Record<string, {
    userId: string;
    username: string;
    avatar: string;
    ready: boolean;
    online: boolean;
    lastActive: number;
  }>;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  game?: ServerGameState;
  chatMessages: ChatMessage[];
  createdAt: number;
}
