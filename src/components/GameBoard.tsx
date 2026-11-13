import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  Flag,
  RotateCcw,
  Shield,
  Swords,
  BookOpen,
  MessageSquare,
  Send,
  AlertTriangle,
  Heart,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { soundManager } from '../audio/soundManager';
import { Card, ClientGameState, Faction, PendingResponse } from '../game/types';
import { getSuitSymbol, formatCardNumber, isRedCard } from '../game/rules';
import { GameLog } from './GameLog';

interface GameBoardProps {
  gameState: ClientGameState;
  userId: string;
  onPlayCard: (cardId: string, targetId?: string) => Promise<void>;
  onRespondCard: (cardId?: string, action?: 'PASS' | 'BAGUA') => Promise<void>;
  onUseSkill: (skillId: string, cardIds?: string[]) => Promise<void>;
  onEndPlayPhase: () => Promise<void>;
  onDiscardCards: (cardIds: string[]) => Promise<void>;
  onSurrender: () => Promise<void>;
  onLeaveGame: () => Promise<void>;
  onSendChat: (text: string, isEmoji?: boolean) => Promise<void>;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const FACTION_COLORS: Record<Faction, { bg: string; text: string; border: string; label: string }> = {
  WEI: { bg: 'bg-blue-950/80', text: 'text-blue-300', border: 'border-blue-700', label: '魏' },
  SHU: { bg: 'bg-red-950/80', text: 'text-red-300', border: 'border-red-700', label: '蜀' },
  WU: { bg: 'bg-green-950/80', text: 'text-green-300', border: 'border-green-700', label: '吴' },
  QUN: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-700', label: '群' },
};

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  userId,
  onPlayCard,
  onRespondCard,
  onUseSkill,
  onEndPlayPhase,
  onDiscardCards,
  onSurrender,
  onLeaveGame,
  onSendChat,
  soundEnabled,
  onToggleSound,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [isActing, setIsActing] = useState(false);

  const { myPlayer, opponentPlayer, isMyTurn, phase, pendingResponse, status, winnerId, endReason } = gameState;

  // Trigger sound cues on new events or responses
  useEffect(() => {
    if (pendingResponse && pendingResponse.targetPlayerId === userId) {
      soundManager.playSlash();
      soundManager.speak(pendingResponse.sourceCardName);
    }
  }, [pendingResponse?.type, pendingResponse?.targetPlayerId, userId]);

  // Victory Confetti on Game Over
  useEffect(() => {
    if (status === 'ENDED') {
      if (winnerId === userId) {
        soundManager.playVictory();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        soundManager.playDefeat();
      }
    }
  }, [status, winnerId, userId]);

  const toggleSelectCard = (cardId: string) => {
    soundManager.playClick();
    setActionError('');
    if (selectedCardIds.includes(cardId)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== cardId));
    } else {
      if (phase === 'DISCARD') {
        // Multi-select for discard
        setSelectedCardIds([...selectedCardIds, cardId]);
      } else {
        // Single select for playing card
        setSelectedCardIds([cardId]);
      }
    }
  };

  const handlePlayCardClick = async () => {
    if (selectedCardIds.length !== 1) return;
    setActionError('');
    setIsActing(true);
    const cardId = selectedCardIds[0];
    const card = myPlayer.hand.find(c => c.id === cardId);
    if (card) {
      soundManager.playCardDraw();
      soundManager.speak(card.name);
    }
    try {
      await onPlayCard(cardId, opponentPlayer.userId);
      setSelectedCardIds([]);
    } catch (err: any) {
      setActionError(err.message || '出牌失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleRespondCardClick = async (cardId?: string) => {
    setActionError('');
    setIsActing(true);
    try {
      if (cardId) {
        soundManager.playDeflect();
      }
      await onRespondCard(cardId);
      setSelectedCardIds([]);
    } catch (err: any) {
      setActionError(err.message || '响应失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleBaguaClick = async () => {
    setActionError('');
    setIsActing(true);
    try {
      soundManager.playGong();
      await onRespondCard(undefined, 'BAGUA');
    } catch (err: any) {
      setActionError(err.message || '八卦阵发动失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleEndPlayPhaseClick = async () => {
    setActionError('');
    setIsActing(true);
    soundManager.playClick();
    try {
      await onEndPlayPhase();
      setSelectedCardIds([]);
    } catch (err: any) {
      setActionError(err.message || '结束出牌失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleDiscardClick = async () => {
    setActionError('');
    setIsActing(true);
    soundManager.playCardDraw();
    try {
      await onDiscardCards(selectedCardIds);
      setSelectedCardIds([]);
    } catch (err: any) {
      setActionError(err.message || '弃牌失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleSkillClick = async (skillId: string) => {
    setActionError('');
    setIsActing(true);
    soundManager.playGong();
    try {
      await onUseSkill(skillId, selectedCardIds);
      setSelectedCardIds([]);
    } catch (err: any) {
      setActionError(err.message || '技能发动失败');
    } finally {
      setIsActing(false);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    soundManager.playClick();
    const text = chatInput.trim();
    setChatInput('');
    await onSendChat(text);
  };

  const neededDiscardCount = Math.max(0, myPlayer.hand.length - Math.max(0, myPlayer.hp));
  const isMyResponse = pendingResponse && pendingResponse.targetPlayerId === userId;

  return (
    <div className="h-screen w-screen bg-[#110b08] text-[#f2e6d8] flex flex-col justify-between select-none overflow-hidden font-sans relative">
      {/* Wood table background with golden framing */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#381f14]/50 via-[#1a0f0a]/90 to-[#0a0503] pointer-events-none" />
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#b8860b_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 h-12 bg-[#1c120c]/90 border-b border-[#5a3820] px-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <span className="font-serif font-black text-sm text-[#ffd700] tracking-widest hidden sm:inline">
            三国杀 ONLINE
          </span>
          <div className="px-2.5 py-0.5 rounded bg-[#2a1a12] border border-[#ffd700]/40 text-xs font-mono text-[#ffd700]">
            房号: {gameState.roomId?.replace('room_', '').toUpperCase() || '对决'}
          </div>
          <div className="px-2.5 py-0.5 rounded bg-[#321c10] border border-[#7a4825] text-xs text-[#f7d08a] font-bold">
            第 {gameState.turnNumber} 回合
          </div>
          <div className={`px-2.5 py-0.5 rounded text-xs font-bold ${
            isMyTurn ? 'bg-red-950 border border-red-500 text-red-300 animate-pulse' : 'bg-stone-900 border border-stone-700 text-stone-400'
          }`}>
            {isMyTurn ? `【你的回合 - ${phase === 'PLAY' ? '出牌阶段' : phase === 'DISCARD' ? '弃牌阶段' : phase}】` : '【对方回合】'}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Action Log Drawer Toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              setShowLogDrawer(!showLogDrawer);
            }}
            className="px-2.5 py-1 rounded bg-[#2a1a12] border border-[#5a3820] text-xs text-[#ffd700] hover:border-[#ffd700] flex items-center space-x-1 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>战报 ({gameState.eventLogs.length})</span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              setShowChatDrawer(!showChatDrawer);
            }}
            className="p-1.5 rounded bg-[#2a1a12] border border-[#5a3820] text-[#f7d08a] hover:border-[#ffd700] cursor-pointer"
            title="聊天"
            aria-label="聊天"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              onToggleSound();
            }}
            className="p-1.5 rounded bg-[#2a1a12] border border-[#5a3820] text-[#f7d08a] hover:border-[#ffd700] cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
            aria-label={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#ffd700]" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>

          {/* Surrender Button */}
          <button
            onClick={() => {
              soundManager.playClick();
              setShowSurrenderConfirm(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-stone-900 border border-red-900/80 text-xs text-red-400 hover:bg-red-950 hover:text-red-300 transition cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>认输</span>
          </button>
        </div>
      </header>

      {/* Opponent Zone (Top) */}
      <section className="relative z-10 p-3 flex flex-wrap items-center justify-between border-b border-[#3a2016] bg-[#170e09]/90 shadow-md">
        <div className="flex items-center space-x-3">
          {/* Hero Avatar & Faction */}
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2a1a12] to-[#120a06] border-2 border-[#b8860b] flex items-center justify-center text-3xl shadow-lg">
              {opponentPlayer.hero.avatar}
            </div>
            <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shadow ${FACTION_COLORS[opponentPlayer.hero.faction].bg} ${FACTION_COLORS[opponentPlayer.hero.faction].text} ${FACTION_COLORS[opponentPlayer.hero.faction].border}`}>
              {FACTION_COLORS[opponentPlayer.hero.faction].label}
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-[#ffd700]">{opponentPlayer.username}</span>
              <span className="text-xs text-[#a88a6d]">[{opponentPlayer.hero.title} · {opponentPlayer.hero.name}]</span>
            </div>

            {/* Opponent HP Magatamas */}
            <div className="flex items-center space-x-1 mt-1">
              <span className="text-xs font-bold text-red-400 mr-1">体力:</span>
              {Array.from({ length: opponentPlayer.maxHp }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shadow transition-all ${
                    idx < opponentPlayer.hp
                      ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                      : 'bg-stone-900 border-stone-700 text-stone-600'
                  }`}
                >
                  <Heart className="w-2.5 h-2.5 fill-current" />
                </div>
              ))}
              <span className="text-xs font-mono text-[#a88a6d] ml-1">
                ({opponentPlayer.hp}/{opponentPlayer.maxHp})
              </span>
            </div>
          </div>
        </div>

        {/* Opponent Equipment & Judge Area */}
        <div className="flex items-center space-x-4">
          {/* Equipment Bar */}
          <div className="flex items-center space-x-1.5 bg-[#120a06] p-1.5 rounded-lg border border-[#3a2016]">
            <div className={`px-2 py-1 rounded text-[11px] border ${opponentPlayer.equipment.weapon ? 'bg-amber-950/80 border-amber-600 text-amber-200' : 'bg-[#1a100a] border-stone-800 text-stone-600'}`} title={opponentPlayer.equipment.weapon?.description || '无武器'}>
              ⚔️ {opponentPlayer.equipment.weapon?.name || '空手 (距离1)'}
            </div>
            <div className={`px-2 py-1 rounded text-[11px] border ${opponentPlayer.equipment.armor ? 'bg-blue-950/80 border-blue-600 text-blue-200' : 'bg-[#1a100a] border-stone-800 text-stone-600'}`} title={opponentPlayer.equipment.armor?.description || '无防具'}>
              🛡️ {opponentPlayer.equipment.armor?.name || '无防具'}
            </div>
            {(opponentPlayer.equipment.offHorse || opponentPlayer.equipment.defHorse) && (
              <div className="px-2 py-1 rounded text-[11px] bg-stone-900 border border-stone-700 text-stone-300">
                🐎 {opponentPlayer.equipment.offHorse?.name || ''} {opponentPlayer.equipment.defHorse?.name || ''}
              </div>
            )}
          </div>

          {/* Delayed Trick / Judge Zone */}
          {opponentPlayer.judges.length > 0 && (
            <div className="flex items-center space-x-1 bg-red-950/40 border border-red-800/60 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-red-400 font-bold">判定:</span>
              {opponentPlayer.judges.map(j => (
                <span key={j.id} className="text-[11px] text-amber-300 bg-red-950 border border-red-600 px-1.5 py-0.5 rounded font-bold animate-pulse">
                  ⚠️ {j.name}
                </span>
              ))}
            </div>
          )}

          {/* Opponent Hidden Hand Cards (Privacy Guarded!) */}
          <div className="flex items-center space-x-1 pl-2 border-l border-[#3a2016]">
            <div className="flex -space-x-3 overflow-hidden">
              {Array.from({ length: opponentPlayer.handCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-7 h-10 rounded bg-gradient-to-br from-[#8b2500] to-[#3a0d00] border border-[#d4af37] shadow flex items-center justify-center text-[10px] text-[#ffd700]"
                >
                  ❖
                </div>
              ))}
            </div>
            <span className="text-xs font-bold text-[#f7d08a] ml-1">
              手牌: {opponentPlayer.handCount} 张
            </span>
          </div>
        </div>
      </section>

      {/* Middle Battlefield Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {/* Error Notification */}
        {actionError && (
          <div className="mb-3 px-4 py-2 rounded-xl bg-red-950/90 border border-red-600 text-red-200 text-xs font-bold shadow-2xl animate-shake">
            ⚠️ {actionError}
          </div>
        )}

        {/* Prominent Pending Response Banner (If Waiting on Player) */}
        {isMyResponse && (
          <div className="w-full max-w-lg mb-4 p-4 rounded-2xl bg-gradient-to-r from-red-950 via-[#45100c] to-red-950 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse text-center">
            <div className="flex items-center justify-center space-x-2 text-sm font-black text-red-200 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>{pendingResponse.prompt}</span>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              {/* If Bagua Zhen is equipped */}
              {myPlayer.equipment.armor?.name === '八卦阵' && pendingResponse.type === 'SHA_RESPONSE' && (
                <button
                  onClick={handleBaguaClick}
                  disabled={isActing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-400 text-xs font-bold text-white shadow-lg hover:brightness-110 cursor-pointer"
                >
                  ☯️ 发动八卦阵判定
                </button>
              )}

              {/* Respond with selected card */}
              {selectedCardIds.length === 1 && (
                <button
                  onClick={() => handleRespondCardClick(selectedCardIds[0])}
                  disabled={isActing}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 border border-green-400 text-xs font-black text-white shadow-lg hover:brightness-110 cursor-pointer"
                >
                  ✓ 打出选中的卡牌
                </button>
              )}

              {/* Pass / Cancel */}
              <button
                onClick={() => handleRespondCardClick(undefined)}
                disabled={isActing}
                className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-600 text-xs text-stone-300 hover:bg-stone-800 cursor-pointer"
              >
                不出 / 承受效果
              </button>
            </div>
          </div>
        )}

        {/* Central battlefield area with Stage and GameLog */}
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-6 px-2">
          {/* Left: Latest played card and deck stats */}
          <div className="flex flex-col items-center justify-center">
            {gameState.lastPlayedCard ? (
              <div className="flex flex-col items-center justify-center bg-[#1f140e]/70 border border-[#5a3820] rounded-2xl p-4 shadow-2xl backdrop-blur-sm max-w-xs">
                <span className="text-[11px] text-[#a88a6d] mb-1 font-serif">最新出牌记录</span>
                <div className="w-24 h-36 rounded-xl bg-gradient-to-b from-[#f9f5ea] to-[#e4d5be] border-2 border-[#b8860b] shadow-[0_10px_25px_rgba(0,0,0,0.8)] text-[#1a1008] p-2 flex flex-col justify-between relative transform hover:scale-105 transition-transform">
                  <div className="flex justify-between items-start">
                    <span className={`text-base font-black ${isRedCard(gameState.lastPlayedCard) ? 'text-red-700' : 'text-black'}`}>
                      {getSuitSymbol(gameState.lastPlayedCard.suit)}{formatCardNumber(gameState.lastPlayedCard.number)}
                    </span>
                    <span className="text-[10px] px-1 rounded bg-[#3a2016] text-[#ffd700] font-bold">
                      {gameState.lastPlayedCard.type === 'BASIC' ? '基本' : gameState.lastPlayedCard.type === 'TRICK' ? '锦囊' : '装备'}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-black tracking-wider text-[#4a1005] font-serif">
                      {gameState.lastPlayedCard.name}
                    </div>
                  </div>
                  <div className="text-[8px] text-[#6d5038] line-clamp-2 text-center leading-tight">
                    {gameState.lastPlayedCard.description}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-[#6d5038] text-xs font-serif p-6 bg-[#170e0a]/40 rounded-2xl border border-[#3a2016]/40">
                ⚔️ 英雄对决，拔剑出鞘 · 请主帅运筹帷幄
              </div>
            )}

            {/* Draw Deck / Discard Pile status */}
            <div className="mt-3 flex items-center space-x-4 text-xs text-[#a88a6d]">
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffd700]" />
                <span>摸牌堆: {gameState.drawDeckCount} 张</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-500" />
                <span>弃牌堆: {gameState.discardPileCount} 张</span>
              </div>
            </div>
          </div>

          {/* Right: Embedded Live Server-Synced GameLog */}
          <GameLog
            events={gameState.eventLogs}
            roomId={gameState.roomId}
            gameId={gameState.gameId}
            className="w-full md:w-96 max-h-60 hidden md:flex shrink-0 shadow-2xl"
          />
        </div>
      </main>

      {/* Player Zone (Bottom) */}
      <footer className="relative z-20 border-t-2 border-[#5a3820] bg-gradient-to-t from-[#140b07] to-[#1c120c] p-3 shadow-2xl flex flex-col space-y-2">
        {/* Row 1: Player Profile, HP, Skills, Equipment */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {/* Hero Avatar & Faction */}
            <div className="relative">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2a1a12] to-[#120a06] border-2 border-[#ffd700] flex items-center justify-center text-3xl shadow-lg">
                {myPlayer.hero.avatar}
              </div>
              <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shadow ${FACTION_COLORS[myPlayer.hero.faction].bg} ${FACTION_COLORS[myPlayer.hero.faction].text} ${FACTION_COLORS[myPlayer.hero.faction].border}`}>
                {FACTION_COLORS[myPlayer.hero.faction].label}
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-[#ffd700]">{myPlayer.username}</span>
                <span className="text-xs text-[#a88a6d]">[{myPlayer.hero.title} · {myPlayer.hero.name}]</span>
              </div>

              {/* Player HP Magatamas */}
              <div className="flex items-center space-x-1 mt-1">
                <span className="text-xs font-bold text-red-400 mr-1">体力:</span>
                {Array.from({ length: myPlayer.maxHp }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shadow transition-all ${
                      idx < myPlayer.hp
                        ? 'bg-gradient-to-br from-red-600 to-red-900 border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                        : 'bg-stone-900 border-stone-700 text-stone-600'
                    }`}
                  >
                    <Heart className="w-2.5 h-2.5 fill-current" />
                  </div>
                ))}
                <span className="text-xs font-mono text-[#a88a6d] ml-1">
                  ({myPlayer.hp}/{myPlayer.maxHp})
                </span>
                {myPlayer.drinkBuff && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500 text-[10px] text-amber-300 font-bold ml-1 animate-pulse">
                    🍺 醉酒 (杀伤+1)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Player Equipment Slots */}
          <div className="flex items-center space-x-1.5 bg-[#120a06] p-1.5 rounded-lg border border-[#3a2016]">
            <div className={`px-2 py-1 rounded text-[11px] border ${myPlayer.equipment.weapon ? 'bg-amber-950/80 border-amber-600 text-amber-200' : 'bg-[#1a100a] border-stone-800 text-stone-600'}`} title={myPlayer.equipment.weapon?.description || '无武器'}>
              ⚔️ {myPlayer.equipment.weapon?.name ? `${myPlayer.equipment.weapon.name} (范围${myPlayer.equipment.weapon.range})` : '空手 (距离1)'}
            </div>
            <div className={`px-2 py-1 rounded text-[11px] border ${myPlayer.equipment.armor ? 'bg-blue-950/80 border-blue-600 text-blue-200' : 'bg-[#1a100a] border-stone-800 text-stone-600'}`} title={myPlayer.equipment.armor?.description || '无防具'}>
              🛡️ {myPlayer.equipment.armor?.name || '无防具'}
            </div>
            {(myPlayer.equipment.offHorse || myPlayer.equipment.defHorse) && (
              <div className="px-2 py-1 rounded text-[11px] bg-stone-900 border border-stone-700 text-stone-300">
                🐎 {myPlayer.equipment.offHorse?.name || ''} {myPlayer.equipment.defHorse?.name || ''}
              </div>
            )}
          </div>

          {/* Hero Skills Trigger Buttons */}
          <div className="flex items-center space-x-2">
            {myPlayer.hero.skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => handleSkillClick(skill.id)}
                disabled={isActing}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#3a2016] to-[#20120b] border border-[#b8860b] hover:border-[#ffd700] text-xs font-bold text-[#ffd700] shadow-md hover:bg-[#4a2e1d] transition cursor-pointer flex items-center space-x-1"
                title={skill.description}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
                <span>{skill.name}</span>
                <span className="text-[10px] text-[#a88a6d] font-normal">
                  ({skill.type === 'LOCKED' ? '锁定' : skill.type === 'ACTIVE' ? '主动' : '触发'})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Hand Cards Area */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex-1 overflow-x-auto pb-1 scrollbar-thin">
            <div className="flex items-end space-x-2 min-w-max px-2">
              {myPlayer.hand.map(card => {
                const isSelected = selectedCardIds.includes(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => toggleSelectCard(card.id)}
                    className={`w-24 h-36 rounded-xl bg-gradient-to-b from-[#fbf8f0] to-[#e4d5be] border-2 cursor-pointer shadow-xl p-2 flex flex-col justify-between relative transition-all duration-150 select-none ${
                      isSelected
                        ? '-translate-y-4 border-[#ffd700] ring-4 ring-[#ffd700]/50 shadow-[0_15px_30px_rgba(255,215,0,0.4)]'
                        : 'border-[#8d7055] hover:-translate-y-2 hover:border-[#d4af37]'
                    }`}
                  >
                    {/* Top rank and suit */}
                    <div className="flex justify-between items-start">
                      <span className={`text-base font-black ${isRedCard(card) ? 'text-red-700' : 'text-black'}`}>
                        {getSuitSymbol(card.suit)}{formatCardNumber(card.number)}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#3a2016] text-[#ffd700] font-bold">
                        {card.type === 'BASIC' ? '基本' : card.type === 'TRICK' ? '锦囊' : '装备'}
                      </span>
                    </div>

                    {/* Center Card Title */}
                    <div className="text-center">
                      <div className="text-base font-black tracking-wider text-[#4a1005] font-serif">
                        {card.name}
                      </div>
                    </div>

                    {/* Bottom description */}
                    <div className="text-[8px] text-[#6d5038] line-clamp-2 text-center leading-tight">
                      {card.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Operations Bar */}
          <div className="pl-4 flex flex-col space-y-2 justify-center min-w-[130px]">
            {phase === 'DISCARD' && isMyTurn ? (
              <button
                onClick={handleDiscardClick}
                disabled={isActing || selectedCardIds.length !== neededDiscardCount}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider transition shadow-lg cursor-pointer ${
                  selectedCardIds.length === neededDiscardCount
                    ? 'bg-gradient-to-r from-red-700 to-red-600 text-white hover:brightness-110'
                    : 'bg-[#2a1a12] border border-[#5a3820] text-stone-500 cursor-not-allowed'
                }`}
              >
                弃牌确定 ({selectedCardIds.length}/{neededDiscardCount})
              </button>
            ) : isMyResponse ? (
              <button
                onClick={() => selectedCardIds.length === 1 && handleRespondCardClick(selectedCardIds[0])}
                disabled={isActing || selectedCardIds.length !== 1}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider transition shadow-lg cursor-pointer ${
                  selectedCardIds.length === 1
                    ? 'bg-gradient-to-r from-green-700 to-emerald-600 text-white hover:brightness-110'
                    : 'bg-[#2a1a12] border border-[#5a3820] text-stone-500 cursor-not-allowed'
                }`}
              >
                打出响应
              </button>
            ) : (
              <>
                <button
                  onClick={handlePlayCardClick}
                  disabled={isActing || !isMyTurn || phase !== 'PLAY' || selectedCardIds.length !== 1}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider transition shadow-lg cursor-pointer ${
                    isMyTurn && phase === 'PLAY' && selectedCardIds.length === 1
                      ? 'bg-gradient-to-r from-[#b8860b] via-[#ffd700] to-[#b8860b] text-[#140e0b] hover:brightness-110 active:scale-95'
                      : 'bg-[#2a1a12] border border-[#5a3820] text-stone-500 cursor-not-allowed'
                  }`}
                >
                  出牌
                </button>

                <button
                  onClick={handleEndPlayPhaseClick}
                  disabled={isActing || !isMyTurn || phase !== 'PLAY'}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border transition cursor-pointer ${
                    isMyTurn && phase === 'PLAY'
                      ? 'bg-[#3a2016] border-[#8a5d3b] text-[#f7d08a] hover:bg-[#5a3820]'
                      : 'bg-[#1a100a] border-stone-800 text-stone-600 cursor-not-allowed'
                  }`}
                >
                  结束出牌
                </button>
              </>
            )}

            {selectedCardIds.length > 0 && (
              <button
                onClick={() => setSelectedCardIds([])}
                className="text-[11px] text-[#a88a6d] hover:text-white text-center cursor-pointer"
              >
                取消选择
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Surrender Confirmation Modal */}
      {showSurrenderConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1c120c] border-2 border-red-700 rounded-2xl p-6 shadow-2xl text-center">
            <h3 className="text-lg font-black text-red-400 mb-2 font-serif flex items-center justify-center space-x-2">
              <Flag className="w-5 h-5" />
              <span>确认认输投降？</span>
            </h3>
            <p className="text-xs text-[#a88a6d] mb-6">
              阵前弃甲，胜败乃兵家常事。认输后将由服务器直接判定对手获胜！
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSurrenderConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#2a1a12] border border-[#5a3820] text-xs text-[#a88a6d] hover:text-white cursor-pointer"
              >
                再战三百回合
              </button>
              <button
                onClick={() => {
                  setShowSurrenderConfirm(false);
                  onSurrender();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-xs font-bold text-white shadow-lg cursor-pointer"
              >
                认输降服
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {status === 'ENDED' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1f140e] border-2 border-[#ffd700] rounded-2xl p-6 shadow-[0_0_50px_rgba(255,215,0,0.3)] text-center relative animate-scale-up">
            <div className="text-5xl mb-3">
              {winnerId === userId ? '🏆' : '💀'}
            </div>
            <h2 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-[#f7d08a] to-[#d4af37] font-serif mb-2">
              {winnerId === userId ? '大获全胜 · 名垂青史' : '胜败常事 · 虽败犹荣'}
            </h2>
            <p className="text-xs text-[#e8d5be] mb-6 px-4 leading-relaxed">
              {endReason || (winnerId === userId ? '你已击溃敌手，威震华夏！' : '体力归零阵亡，来日方长！')}
            </p>

            <div className="p-3 rounded-xl bg-[#120a06] border border-[#4a2e1d] mb-6 text-xs text-[#a88a6d] space-y-1">
              <p>⚔️ 比赛总回合数: {gameState.turnNumber} 回合</p>
              <p>👑 获胜主帅: {winnerId === userId ? myPlayer.username : opponentPlayer.username}</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onLeaveGame}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#b8860b] to-[#ffd700] text-[#140e0b] font-black text-sm tracking-wider shadow-lg hover:brightness-110 cursor-pointer"
              >
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Log Drawer */}
      {showLogDrawer && (
        <div className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-[#170e09]/95 border-l border-[#5a3820] shadow-2xl flex flex-col p-3 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#3a2016] mb-2">
            <h3 className="text-sm font-bold text-[#ffd700] flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#b8860b]" />
              <span>军情推演战报</span>
            </h3>
            <button
              onClick={() => setShowLogDrawer(false)}
              className="text-[#a88a6d] hover:text-white text-xs cursor-pointer px-2 py-0.5 rounded bg-[#2a1a12] border border-[#5a3820]"
            >
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <GameLog
              events={gameState.eventLogs}
              roomId={gameState.roomId}
              gameId={gameState.gameId}
              className="h-full w-full border-0 bg-transparent"
            />
          </div>
        </div>
      )}

      {/* Chat Drawer */}
      {showChatDrawer && (
        <div className="fixed inset-y-0 right-0 z-40 w-80 bg-[#170e09]/95 border-l border-[#5a3820] shadow-2xl flex flex-col p-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#3a2016] mb-3">
            <h3 className="text-sm font-bold text-[#ffd700] flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-[#b8860b]" />
              <span>战场互动密语</span>
            </h3>
            <button
              onClick={() => setShowChatDrawer(false)}
              className="text-[#a88a6d] hover:text-white text-xs cursor-pointer"
            >
              关闭
            </button>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {['请出牌！', '杀得好！', '等等我想想', '决一死战！', '承让承让！'].map(phrase => (
              <button
                key={phrase}
                onClick={() => {
                  soundManager.playClick();
                  onSendChat(phrase);
                }}
                className="px-2 py-1 rounded bg-[#2a1a12] border border-[#4a2e1d] text-[10px] text-[#f7d08a] hover:border-[#ffd700] cursor-pointer"
              >
                {phrase}
              </button>
            ))}
          </div>

          <div className="flex space-x-1 mb-3">
            {['⚔️', '🔥', '🛡️', '⚡', '🏆', '🍺'].map(em => (
              <button
                key={em}
                onClick={() => {
                  soundManager.playClick();
                  onSendChat(em, true);
                }}
                className="w-7 h-7 rounded bg-[#2a1a12] border border-[#4a2e1d] flex items-center justify-center text-sm hover:border-[#ffd700] cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendChatMessage} className="flex space-x-2 mt-auto">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="发送战局密信..."
              maxLength={60}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0e0805] border border-[#4a2e1d] text-xs text-[#e8d5be] focus:border-[#ffd700] focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#3a2016] text-[#ffd700] text-xs font-bold border border-[#b8860b] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
