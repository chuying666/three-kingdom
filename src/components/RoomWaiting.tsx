import React, { useState } from 'react';
import { Copy, Check, Users, Swords, LogOut, MessageSquare, Send, Sparkles, Link2, AlertTriangle } from 'lucide-react';
import { soundManager } from '../audio/soundManager';
import { ChatMessage } from '../game/types';
import { buildInviteUrl, isPrivatePreviewHost } from '../game/invite';

interface RoomPlayerInfo {
  userId: string;
  username: string;
  avatar: string;
  ready: boolean;
  online: boolean;
}

interface RoomWaitingProps {
  roomId: string;
  roomCode: string;
  currentUserId: string;
  hostId: string;
  players: RoomPlayerInfo[];
  chatMessages: ChatMessage[];
  onToggleReady: (ready: boolean) => Promise<void>;
  onStartGame: () => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onSendChat: (text: string, isEmoji?: boolean) => Promise<void>;
}

const QUICK_PHRASES = [
  '你好！请多指教！',
  '快快准备，大战一触即发！',
  '稍等片刻，我整顿一下行装。',
  '今日定要与你决一雌雄！',
  '承让，看谁笑到最后！',
];

const QUICK_EMOJIS = ['⚔️', '🔥', '🛡️', '⚡', '🏆', '🍺', '👑', '💀'];

export const RoomWaiting: React.FC<RoomWaitingProps> = ({
  roomId,
  roomCode,
  currentUserId,
  hostId,
  players,
  chatMessages,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  onSendChat,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const me = players.find(p => p.userId === currentUserId);
  const opponent = players.find(p => p.userId !== currentUserId);
  const isHost = hostId === currentUserId;

  const bothReady = players.length === 2 && players.every(p => p.ready);
  const canStart = isHost && bothReady;
  const inviteUrl = buildInviteUrl(window.location.origin, window.location.pathname, roomCode);
  const isPrivatePreview = isPrivatePreviewHost(window.location.hostname);

  const copyTextSafe = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleCopyCode = async () => {
    soundManager.playClick();
    await copyTextSafe(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = async () => {
    soundManager.playClick();
    await copyTextSafe(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleReadyClick = async () => {
    if (!me) return;
    soundManager.playClick();
    setErrorMsg('');
    try {
      await onToggleReady(!me.ready);
    } catch (err: any) {
      setErrorMsg(err.message || '操作失败');
    }
  };

  const handleStartGameClick = async () => {
    if (!canStart) return;
    soundManager.playGong();
    setErrorMsg('');
    setLoading(true);
    try {
      await onStartGame();
    } catch (err: any) {
      setErrorMsg(err.message || '启动游戏失败');
      setLoading(false);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    soundManager.playClick();
    const text = chatInput.trim();
    setChatInput('');
    try {
      await onSendChat(text);
    } catch {
      // Ignored
    }
  };

  const handleSendEmoji = async (emoji: string) => {
    soundManager.playClick();
    try {
      await onSendChat(emoji, true);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="min-h-screen bg-[#140e0b] text-[#e8d5be] flex flex-col justify-between selection:bg-[#c2382c] selection:text-white font-sans relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#3a2016]/40 via-[#180f0a]/90 to-[#0c0705] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b8860b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 border-b border-[#4a2e1d] bg-[#1a110c]/80 backdrop-blur px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onLeaveRoom();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a12] border border-[#5a3820] text-xs hover:border-[#b8860b] text-[#f7d08a] transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>退出房间</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#ffd700] font-serif">备战点将营</h1>
            <p className="text-xs text-[#a88a6d]">双人真人对战准备区</p>
          </div>
        </div>

        {/* Room Code & Invite Link Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyInviteLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#9b111e] to-[#b82e1f] border border-[#ffd700]/60 text-xs font-bold text-white hover:brightness-110 transition cursor-pointer shadow-lg"
            title="复制带房间号的邀请链接发送给好友"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-300" /> : <Link2 className="w-3.5 h-3.5 text-[#ffd700]" />}
            <span>{copiedLink ? '已复制邀请链接' : '复制邀请链接'}</span>
          </button>

          <div className="flex items-center space-x-2 bg-[#2a1a12] border border-[#ffd700]/50 px-3 py-1.5 rounded-xl shadow-lg">
            <span className="text-xs text-[#a88a6d] hidden sm:inline">房间码:</span>
            <span className="font-mono font-black text-base sm:text-lg text-[#ffd700] tracking-wider">{roomCode}</span>
            <button
              onClick={handleCopyCode}
              className="p-1 rounded hover:bg-[#3a2016] text-[#ffd700] transition cursor-pointer"
              title="复制房间码"
              aria-label="复制房间码"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Chamber */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-center">
        {isPrivatePreview && (
          <div className="mb-4 p-3 rounded-xl bg-amber-950/70 border border-amber-600/70 text-amber-200 text-xs flex items-start space-x-2 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">注意：</span>
              当前处于编辑器私有预览链接（<span className="font-mono">ais-dev-...</span>），好友无法直接访问。请通过页面右上角 <strong>Share</strong> 打开正式分享链接（<span className="font-mono">ais-pre-...</span>）建房后，再复制邀请链接发给好友！
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="max-w-md mx-auto mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700/80 text-red-200 text-xs text-center shadow-lg">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Both Players Battle Stage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Player 1 Card (You or Opponent) */}
          <div className={`p-6 rounded-2xl border-2 transition relative ${
            me?.ready
              ? 'bg-[#1e1c12] border-[#22c55e]/80 shadow-[0_0_25px_rgba(34,197,94,0.2)]'
              : 'bg-[#1f140e] border-[#5a3820] shadow-xl'
          }`}>
            <div className="absolute top-3 right-3 flex items-center space-x-2">
              {isHost && (
                <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/60 text-[10px] text-amber-300 font-bold">
                  👑 房主
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                me?.ready ? 'bg-green-900/60 border border-green-500 text-green-300' : 'bg-yellow-950 border border-yellow-700 text-yellow-400'
              }`}>
                {me?.ready ? '✓ 已准备' : '⏳ 准备中'}
              </span>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-[#2a1a12] border-2 border-[#b8860b] flex items-center justify-center text-3xl shadow-inner">
                {me?.avatar}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#ffd700]">{me?.username}</h3>
                <p className="text-xs text-[#a88a6d]">身份: 本地玩家 (真人)</p>
                <div className={`flex items-center space-x-1.5 mt-1 text-[11px] ${me?.online ? 'text-green-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${me?.online ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{me?.online ? '实时在线' : '连接同步中...'}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#3a2016]">
              <button
                onClick={handleReadyClick}
                className={`w-full py-2.5 rounded-xl font-bold text-sm tracking-wider transition cursor-pointer shadow-md ${
                  me?.ready
                    ? 'bg-yellow-700 hover:bg-yellow-600 text-white border border-yellow-500'
                    : 'bg-green-700 hover:bg-green-600 text-white border border-green-500'
                }`}
              >
                {me?.ready ? '取消准备' : '立即准备'}
              </button>
            </div>
          </div>

          {/* Player 2 Card (Opponent or Waiting Slot) */}
          {opponent ? (
            <div className={`p-6 rounded-2xl border-2 transition relative ${
              opponent.ready
                ? 'bg-[#1e1c12] border-[#22c55e]/80 shadow-[0_0_25px_rgba(34,197,94,0.2)]'
                : 'bg-[#1f140e] border-[#5a3820] shadow-xl'
            }`}>
              <div className="absolute top-3 right-3 flex items-center space-x-2">
                {hostId === opponent.userId && (
                  <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/60 text-[10px] text-amber-300 font-bold">
                    👑 房主
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  opponent.ready ? 'bg-green-900/60 border border-green-500 text-green-300' : 'bg-yellow-950 border border-yellow-700 text-yellow-400'
                }`}>
                  {opponent.ready ? '✓ 已准备' : '⏳ 准备中'}
                </span>
              </div>

              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-[#2a1a12] border-2 border-[#b8860b] flex items-center justify-center text-3xl shadow-inner">
                  {opponent.avatar}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#ffd700]">{opponent.username}</h3>
                  <p className="text-xs text-[#a88a6d]">身份: 对手 (真人联网)</p>
                  <div className={`flex items-center space-x-1.5 mt-1 text-[11px] ${opponent.online ? 'text-green-400' : 'text-amber-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${opponent.online ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span>{opponent.online ? '实时在线连接' : '对手重连中...'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#3a2016] text-center text-xs text-[#a88a6d]">
                {opponent.ready ? '🎉 对手已准备就绪！' : '等待对手点击准备……'}
              </div>
            </div>
          ) : (
            /* Waiting for second player */
            <div className="p-6 rounded-2xl border-2 border-dashed border-[#5a3820] bg-[#1a110c]/50 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#2a1a12] border border-[#5a3820] flex items-center justify-center text-2xl text-[#8d7055] mb-3 animate-pulse">
                <Users className="w-6 h-6 text-[#b8860b]" />
              </div>
              <h3 className="text-base font-bold text-[#f7d08a] mb-1">等待第二位真人英雄加入</h3>
              <p className="text-xs text-[#a88a6d] max-w-xs mb-3">
                复制下方邀请链接发送给好友，点开即可直达本房间（房间码 <span className="font-mono text-[#ffd700] font-bold">{roomCode}</span>）：
              </p>
              <div className="w-full max-w-xs mb-3 px-2.5 py-1.5 rounded-lg bg-[#0e0805] border border-[#4a2e1d] text-[10px] font-mono text-[#d8c2aa] truncate select-all">
                {inviteUrl}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#9b111e] to-[#b82e1f] border border-[#ffd700]/70 text-xs font-bold text-white hover:brightness-110 transition cursor-pointer flex items-center space-x-1.5 shadow"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-300" /> : <Link2 className="w-4 h-4 text-[#ffd700]" />}
                  <span>{copiedLink ? '已复制邀请链接！' : '复制邀请链接'}</span>
                </button>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-2 rounded-lg bg-[#2a1a12] border border-[#ffd700]/50 text-xs font-bold text-[#ffd700] hover:bg-[#3a2016] transition cursor-pointer flex items-center space-x-1.5 shadow"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '已复制房间码' : '仅复制房间码'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Start Game Action */}
        <div className="text-center mb-6">
          {isHost ? (
            <button
              onClick={handleStartGameClick}
              disabled={!canStart || loading}
              className={`py-4 px-10 rounded-2xl font-black text-lg tracking-widest transition shadow-2xl flex items-center justify-center space-x-3 mx-auto cursor-pointer ${
                canStart
                  ? 'bg-gradient-to-r from-[#b8860b] via-[#ffd700] to-[#b8860b] text-[#140e0b] hover:brightness-110 active:scale-95 animate-pulse'
                  : 'bg-[#2a1a12] border border-[#5a3820] text-[#7d6045] cursor-not-allowed'
              }`}
            >
              <Swords className="w-6 h-6" />
              <span>{loading ? '正在开战...' : bothReady ? '双方就绪，开战决斗！' : '等待双方准备（需满2人）'}</span>
              <Sparkles className="w-5 h-5" />
            </button>
          ) : (
            <div className="text-xs text-[#a88a6d]">
              {bothReady ? '双方均已准备就绪，等待房主开启对局……' : '请点击【立即准备】，等待房主开启对局'}
            </div>
          )}
        </div>

        {/* Room Live Chat & Quick Emotes */}
        <div className="bg-[#1a100a] border border-[#4a2e1d] rounded-2xl p-4 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#b8860b] mb-2 pb-1 border-b border-[#3a2016]">
            <MessageSquare className="w-4 h-4" />
            <span>军机营密信互动</span>
          </div>

          {/* Chat message box */}
          <div className="h-28 overflow-y-auto space-y-1.5 text-xs pr-1 mb-3 scrollbar-thin">
            {chatMessages.length === 0 ? (
              <p className="text-[#6d5038] italic text-center py-6">尚无密信消息，可发送快捷短语或表情打招呼～</p>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} className="flex items-start space-x-2">
                  <span className={`font-bold ${msg.userId === currentUserId ? 'text-[#ffd700]' : 'text-[#87ceeb]'}`}>
                    {msg.username}:
                  </span>
                  <span className={`${msg.isEmoji ? 'text-xl' : 'text-[#e8d5be]'}`}>{msg.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Quick Phrases & Emotes */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_EMOJIS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => handleSendEmoji(em)}
                className="w-7 h-7 rounded bg-[#2a1a12] hover:bg-[#3a2016] border border-[#4a2e1d] text-sm flex items-center justify-center cursor-pointer transition"
              >
                {em}
              </button>
            ))}
            {QUICK_PHRASES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  onSendChat(p);
                }}
                className="px-2 py-1 rounded bg-[#2a1a12] hover:bg-[#3a2016] border border-[#4a2e1d] text-[11px] text-[#a88a6d] hover:text-[#ffd700] transition cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChatMessage} className="flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="发送营地消息..."
              maxLength={60}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0e0805] border border-[#4a2e1d] text-xs text-[#e8d5be] focus:border-[#ffd700] focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#3a2016] hover:bg-[#5a3820] text-xs text-[#ffd700] font-bold border border-[#b8860b] flex items-center space-x-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发送</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
