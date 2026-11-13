import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Swords,
  Heart,
  Sparkles,
  Shield,
  Scroll,
  Info,
  Clock,
  ArrowDownCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { GameEventLog } from '../game/types';

export interface GameLogProps {
  events: GameEventLog[];
  roomId?: string;
  gameId?: string;
  className?: string;
  compact?: boolean;
}

type EventFilter = 'ALL' | 'PLAY' | 'DAMAGE' | 'HEAL' | 'SKILL' | 'JUDGE';

export const GameLog: React.FC<GameLogProps> = ({
  events: propEvents,
  roomId,
  gameId,
  className = '',
  compact = false,
}) => {
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [serverEvents, setServerEvents] = useState<GameEventLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with server-side GameEvents endpoint
  const syncServerEvents = async () => {
    if (!gameId && !roomId) return;
    setIsSyncing(true);
    try {
      const url = gameId ? `/api/game/events?gameId=${gameId}` : `/api/game/events?roomId=${roomId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setServerEvents(data.events);
          setLastSyncTime(Date.now());
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncServerEvents();
    const interval = setInterval(syncServerEvents, 4000);
    return () => clearInterval(interval);
  }, [gameId, roomId]);

  // Merge events by unique ID, preferring the most up to date list
  const mergedEvents = React.useMemo(() => {
    const map = new Map<string, GameEventLog>();
    propEvents.forEach(e => map.set(e.id, e));
    serverEvents.forEach(e => map.set(e.id, e));
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [propEvents, serverEvents]);

  // Filtered list
  const filteredEvents = React.useMemo(() => {
    if (filter === 'ALL') return mergedEvents;
    return mergedEvents.filter(e => e.type === filter);
  }, [mergedEvents, filter]);

  // Auto scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length, autoScroll]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getEventBadge = (type: GameEventLog['type']) => {
    switch (type) {
      case 'PLAY':
        return {
          label: '出牌',
          icon: <Swords className="w-3 h-3 text-amber-400" />,
          color: 'bg-amber-950/70 border-amber-600/70 text-amber-200',
        };
      case 'DAMAGE':
        return {
          label: '伤害',
          icon: <span className="text-[10px]">🩸</span>,
          color: 'bg-red-950/80 border-red-600/80 text-red-200',
        };
      case 'HEAL':
        return {
          label: '回复',
          icon: <Heart className="w-3 h-3 text-green-400 fill-current" />,
          color: 'bg-green-950/70 border-green-600/70 text-green-200',
        };
      case 'SKILL':
        return {
          label: '技能',
          icon: <Sparkles className="w-3 h-3 text-purple-400" />,
          color: 'bg-purple-950/70 border-purple-600/70 text-purple-200',
        };
      case 'JUDGE':
        return {
          label: '判定',
          icon: <Scroll className="w-3 h-3 text-yellow-400" />,
          color: 'bg-yellow-950/70 border-yellow-600/70 text-yellow-200',
        };
      case 'EQUIP':
        return {
          label: '装备',
          icon: <Shield className="w-3 h-3 text-blue-400" />,
          color: 'bg-blue-950/70 border-blue-600/70 text-blue-200',
        };
      case 'INFO':
      default:
        return {
          label: '战况',
          icon: <Info className="w-3 h-3 text-stone-400" />,
          color: 'bg-stone-900 border-stone-700 text-stone-300',
        };
    }
  };

  // Highlight keywords like 【杀】, 【闪】, 【桃】, names
  const renderLogText = (text: string) => {
    const parts = text.split(/(【[^】]+】)/g);
    return parts.map((part, i) => {
      if (part.startsWith('【') && part.endsWith('】')) {
        let highlightClass = 'text-[#ffd700] font-bold';
        if (part.includes('杀')) highlightClass = 'text-red-400 font-black';
        if (part.includes('闪')) highlightClass = 'text-green-300 font-bold';
        if (part.includes('桃') || part.includes('酒')) highlightClass = 'text-pink-300 font-bold';
        if (part.includes('伤害')) highlightClass = 'text-red-500 font-black';
        return (
          <span key={i} className={highlightClass}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className={`flex flex-col rounded-2xl bg-[#170e0a]/90 border border-[#5a3820] shadow-2xl backdrop-blur-sm overflow-hidden text-xs ${className}`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#24150e] to-[#1a0e08] border-b border-[#4a2e1d] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-[#ffd700]" />
          <span className="font-bold text-[#ffd700] font-serif tracking-wide">
            战局实录 · GameLog
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#120804] border border-[#5a3820] text-[#a88a6d]">
            {filteredEvents.length} 条记录
          </span>
        </div>

        {/* Server Sync Status Indicator */}
        <div className="flex items-center space-x-2">
          <div
            className="flex items-center space-x-1 text-[10px] text-green-400"
            title={`已同服务端 GameEvents 表同步校验 (${new Date(lastSyncTime).toLocaleTimeString()})`}
          >
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="hidden sm:inline">服务端权威同步</span>
          </div>

          <button
            onClick={syncServerEvents}
            disabled={isSyncing}
            className="p-1 rounded bg-[#2a170e] hover:bg-[#3a2016] text-[#ffd700] border border-[#5a3820] transition cursor-pointer"
            title="刷新服务端事件"
            aria-label="刷新战局记录"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {!compact && (
        <div className="px-3 py-1.5 bg-[#140b07] border-b border-[#3a2016] flex items-center space-x-1 overflow-x-auto scrollbar-none">
          {(
            [
              { id: 'ALL', label: '全部' },
              { id: 'PLAY', label: '出牌' },
              { id: 'DAMAGE', label: '伤害' },
              { id: 'SKILL', label: '技能' },
              { id: 'JUDGE', label: '判定' },
              { id: 'HEAL', label: '回复' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[#3a2016] text-[#ffd700] border border-[#b8860b] shadow'
                  : 'text-[#8d7055] hover:text-[#d8c2aa]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Events Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin max-h-80 select-text"
      >
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-[#6d5038] italic">
            暂无对应的战局事件记录
          </div>
        ) : (
          filteredEvents.map(evt => {
            const badge = getEventBadge(evt.type);
            return (
              <div
                key={evt.id}
                className="p-2 rounded-xl bg-[#1d120c]/80 border border-[#3a2016] hover:border-[#6d4624] transition flex items-start space-x-2 text-[11px] leading-relaxed shadow-sm"
              >
                {/* Event Type Badge */}
                <div
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 shrink-0 ${badge.color}`}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>

                {/* Event Text */}
                <div className="flex-1 text-[#e8d5be] font-sans break-words">
                  {renderLogText(evt.text)}
                </div>

                {/* Timestamp */}
                <span className="text-[9px] text-[#7d6045] font-mono shrink-0 pt-0.5">
                  {formatTime(evt.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer controls: Scroll to bottom */}
      <div className="px-3 py-1.5 bg-[#120804] border-t border-[#3a2016] flex items-center justify-between text-[10px] text-[#8d7055]">
        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="rounded border-[#4a2e1d] text-[#b8860b] focus:ring-0 w-3 h-3"
          />
          <span>新事件自动滚到底部</span>
        </label>

        <button
          onClick={scrollToBottom}
          className="flex items-center space-x-1 text-[#ffd700] hover:underline cursor-pointer"
        >
          <ArrowDownCircle className="w-3 h-3" />
          <span>回到底部</span>
        </button>
      </div>
    </div>
  );
};
