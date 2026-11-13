import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lobby } from './components/Lobby';
import { RoomWaiting } from './components/RoomWaiting';
import { GameBoard } from './components/GameBoard';
import { ClientGameState, ChatMessage } from './game/types';
import { soundManager } from './audio/soundManager';
import { extractRoomCodeFromSearch } from './game/invite';

interface RoomSummary {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  players: Array<{
    userId: string;
    username: string;
    avatar: string;
    ready: boolean;
    online: boolean;
  }>;
  playerCount: number;
  chatMessages: ChatMessage[];
  hasGame: boolean;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'LOBBY' | 'WAITING' | 'GAME'>('LOBBY');
  const [roomId, setRoomId] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomSummary | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sgs_sound') !== 'false';
  });
  const [invitedRoomCode, setInvitedRoomCode] = useState<string>(() => {
    return extractRoomCodeFromSearch(window.location.search);
  });
  const [sessionNotice, setSessionNotice] = useState<string>('');

  const sseRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<any>(null);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
    localStorage.setItem('sgs_sound', String(next));
  };

  // Close SSE stream
  const closeStream = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    closeStream();
    setRoomId('');
    setRoomCode('');
    setUserId('');
    setRoomState(null);
    setGameState(null);
    setCurrentView('LOBBY');
    sessionStorage.removeItem('sgs_active_room_id');
    sessionStorage.removeItem('sgs_active_room_code');
    sessionStorage.removeItem('sgs_active_user_id');
  }, [closeStream]);

  // Fetch full state (used as initial fetch and polling safety net)
  const fetchState = useCallback(async (rId: string, uId: string) => {
    try {
      const res = await fetch(`/api/room/state?roomId=${rId}&userId=${uId}`);
      if (res.status === 404) {
        clearSession();
        setSessionNotice('之前的房间已结束或失效，请重新创建或加入房间。');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.room) {
        setRoomState(data.room);
        if (data.game) {
          setGameState(data.game);
          setCurrentView('GAME');
        } else if (data.room.status === 'WAITING') {
          setCurrentView('WAITING');
        }
      }
    } catch {
      // Ignore network flutter
    }
  }, [clearSession]);

  // Connect Real-time Server-Sent Events stream
  const connectStream = useCallback((rId: string, uId: string) => {
    closeStream();

    // SSE connection
    const sse = new EventSource(`/api/stream?roomId=${rId}&userId=${uId}`);
    sseRef.current = sse;

    sse.addEventListener('room_state', (e: MessageEvent) => {
      try {
        const room: RoomSummary = JSON.parse(e.data);
        setRoomState(room);
        if (room.status === 'WAITING') {
          setCurrentView(prev => (prev === 'GAME' ? prev : 'WAITING'));
        }
      } catch {}
    });

    sse.addEventListener('game_state', (e: MessageEvent) => {
      try {
        const game: ClientGameState = JSON.parse(e.data);
        setGameState(game);
        setCurrentView('GAME');
      } catch {}
    });

    sse.onerror = () => {
      // Reconnect is handled automatically by EventSource
    };

    // Also run a 2s safety polling heartbeat in parallel
    pollTimerRef.current = setInterval(() => {
      fetchState(rId, uId);
    }, 2000);

    fetchState(rId, uId);
  }, [closeStream, fetchState]);

  // Handle re-entering room on refresh
  useEffect(() => {
    const savedRoomId = sessionStorage.getItem('sgs_active_room_id');
    const savedUserId = sessionStorage.getItem('sgs_active_user_id');
    const savedRoomCode = sessionStorage.getItem('sgs_active_room_code');
    const urlInvite = extractRoomCodeFromSearch(window.location.search);

    if (savedRoomId && savedUserId && savedRoomCode) {
      if (urlInvite && urlInvite !== savedRoomCode) {
        clearSession();
      } else {
        setRoomId(savedRoomId);
        setUserId(savedUserId);
        setRoomCode(savedRoomCode);
        connectStream(savedRoomId, savedUserId);
      }
    }

    return () => {
      closeStream();
    };
  }, [connectStream, closeStream, clearSession]);

  const clearInviteUrlParam = () => {
    setInvitedRoomCode('');
    setSessionNotice('');
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const saveSession = (rId: string, rCode: string, uId: string) => {
    setRoomId(rId);
    setRoomCode(rCode);
    setUserId(uId);
    sessionStorage.setItem('sgs_active_room_id', rId);
    sessionStorage.setItem('sgs_active_room_code', rCode);
    sessionStorage.setItem('sgs_active_user_id', uId);
    clearInviteUrlParam();
  };

  // --- API Handlers ---

  const handleCreateRoom = async (username: string, avatar: string) => {
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, avatar }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '创建房间失败');

    saveSession(data.roomId, data.roomCode, data.userId);
    connectStream(data.roomId, data.userId);
    setCurrentView('WAITING');
  };

  const handleJoinRoom = async (code: string, username: string, avatar: string) => {
    const savedRoomCode = sessionStorage.getItem('sgs_active_room_code');
    const existingUserId =
      savedRoomCode === code.trim().toUpperCase()
        ? sessionStorage.getItem('sgs_active_user_id') || undefined
        : undefined;
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, username, avatar, existingUserId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '加入房间失败');

    saveSession(data.roomId, data.roomCode, data.userId);
    connectStream(data.roomId, data.userId);
    setCurrentView('WAITING');
  };

  const handleQuickMatch = async (username: string, avatar: string) => {
    const res = await fetch('/api/room/quick-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, avatar }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '匹配失败');

    saveSession(data.roomId, data.roomCode, data.userId);
    connectStream(data.roomId, data.userId);
    setCurrentView('WAITING');
  };

  const handleToggleReady = async (ready: boolean) => {
    const res = await fetch('/api/room/ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId, ready }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '切换准备状态失败');
  };

  const handleStartGame = async () => {
    const res = await fetch('/api/room/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '开启决战失败');
  };

  const handleLeaveRoom = async () => {
    try {
      await fetch('/api/room/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId }),
      });
    } catch {}
    clearSession();
  };

  const handlePlayCard = async (cardId: string, targetId?: string) => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'PLAY_CARD',
        cardId,
        targetId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '出牌失败');
  };

  const handleRespondCard = async (cardId?: string, action?: 'PASS' | 'BAGUA') => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'RESPOND_CARD',
        cardId,
        action: action || (!cardId ? 'PASS' : undefined),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '响应失败');
  };

  const handleUseSkill = async (skillId: string, cardIds?: string[]) => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'USE_SKILL',
        skillId,
        cardIds,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '技能发动失败');
  };

  const handleEndPlayPhase = async () => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'END_PLAY',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '操作失败');
  };

  const handleDiscardCards = async (cardIds: string[]) => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'DISCARD',
        cardIds,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '弃牌失败');
  };

  const handleSurrender = async () => {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        actionType: 'SURRENDER',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '认输失败');
  };

  const handleSendChat = async (text: string, isEmoji?: boolean) => {
    const currentName = roomState?.players.find(p => p.userId === userId)?.username || '主帅';
    await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        username: currentName,
        text,
        isEmoji,
      }),
    });
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#110b08]">
      {currentView === 'LOBBY' && (
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onQuickMatch={handleQuickMatch}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          invitedRoomCode={invitedRoomCode}
          onClearInvite={clearInviteUrlParam}
          sessionNotice={sessionNotice}
        />
      )}

      {currentView === 'WAITING' && roomState && (
        <RoomWaiting
          roomId={roomId}
          roomCode={roomCode}
          currentUserId={userId}
          hostId={roomState.hostId}
          players={roomState.players}
          chatMessages={roomState.chatMessages}
          onToggleReady={handleToggleReady}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
          onSendChat={handleSendChat}
        />
      )}

      {currentView === 'GAME' && gameState && (
        <GameBoard
          gameState={gameState}
          userId={userId}
          onPlayCard={handlePlayCard}
          onRespondCard={handleRespondCard}
          onUseSkill={handleUseSkill}
          onEndPlayPhase={handleEndPlayPhase}
          onDiscardCards={handleDiscardCards}
          onSurrender={handleSurrender}
          onLeaveGame={handleLeaveRoom}
          onSendChat={handleSendChat}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />
      )}
    </div>
  );
}
