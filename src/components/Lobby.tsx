import React, { useState } from 'react';
import { Swords, Users, PlusCircle, LogIn, Volume2, VolumeX, BookOpen, Sparkles, Link2, X } from 'lucide-react';
import { soundManager } from '../audio/soundManager';

interface LobbyProps {
  onJoinRoom: (roomCode: string, username: string, avatar: string) => Promise<void>;
  onCreateRoom: (username: string, avatar: string) => Promise<void>;
  onQuickMatch: (username: string, avatar: string) => Promise<void>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  invitedRoomCode?: string;
  onClearInvite?: () => void;
  sessionNotice?: string;
}

const AVATAR_OPTIONS = ['👑', '⚔️', '🏹', '🐲', '🐯', '🦅', '🌸', '🏮', '🗡️', '🛡️', '⚡', '💊'];

export const Lobby: React.FC<LobbyProps> = ({
  onJoinRoom,
  onCreateRoom,
  onQuickMatch,
  soundEnabled,
  onToggleSound,
  invitedRoomCode,
  onClearInvite,
  sessionNotice,
}) => {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('sgs_username') || `将士${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem('sgs_avatar') || '👑';
  });
  const [inputCode, setInputCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{
    loading: boolean;
    exists?: boolean;
    hostName?: string;
    hostAvatar?: string;
    playerCount?: number;
    status?: string;
    canJoin?: boolean;
    error?: string;
  } | null>(null);
  const [activeRooms, setActiveRooms] = useState<Array<{
    roomId: string;
    roomCode: string;
    hostName: string;
    hostAvatar: string;
    playerCount: number;
    status: 'WAITING' | 'PLAYING';
    createdAt: number;
  }>>([]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setActiveRooms(data.rooms || []);
      }
    } catch {}
  };

  React.useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!invitedRoomCode) {
      setInviteInfo(null);
      return;
    }
    let cancelled = false;
    setInviteInfo({ loading: true });
    fetch(`/api/room/lookup?roomCode=${encodeURIComponent(invitedRoomCode)}`)
      .then(async res => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.exists) {
          setInviteInfo({
            loading: false,
            exists: false,
            error: data.error || `未找到房间【${invitedRoomCode}】`,
          });
        } else {
          setInviteInfo({
            loading: false,
            exists: true,
            hostName: data.hostName,
            hostAvatar: data.hostAvatar,
            playerCount: data.playerCount,
            status: data.status,
            canJoin: data.canJoin,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInviteInfo({
            loading: false,
            exists: false,
            error: `查询房间【${invitedRoomCode}】失败，请检查网络连接`,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [invitedRoomCode]);

  const saveProfile = (newName: string, newAvatar: string) => {
    setUsername(newName);
    setAvatar(newAvatar);
    localStorage.setItem('sgs_username', newName);
    localStorage.setItem('sgs_avatar', newAvatar);
  };

  const handleQuickMatch = async () => {
    setErrorMsg('');
    soundManager.playClick();
    if (!username.trim()) {
      setErrorMsg('请输入你的大名！');
      return;
    }
    setLoading(true);
    try {
      await onQuickMatch(username.trim(), avatar);
    } catch (err: any) {
      setErrorMsg(err.message || '匹配失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    setErrorMsg('');
    soundManager.playClick();
    if (!username.trim()) {
      setErrorMsg('请输入你的大名！');
      return;
    }
    setLoading(true);
    try {
      await onCreateRoom(username.trim(), avatar);
    } catch (err: any) {
      setErrorMsg(err.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    soundManager.playClick();
    if (!inputCode.trim()) {
      setErrorMsg('请输入4位房间码');
      return;
    }
    setLoading(true);
    try {
      await onJoinRoom(inputCode.trim().toUpperCase(), username.trim(), avatar);
      setShowJoinModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinInvitedRoom = async () => {
    if (!invitedRoomCode) return;
    setErrorMsg('');
    soundManager.playClick();
    if (!username.trim()) {
      setErrorMsg('请输入你的大名！');
      return;
    }
    setLoading(true);
    try {
      await onJoinRoom(invitedRoomCode, username.trim(), avatar);
    } catch (err: any) {
      setErrorMsg(err.message || '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-[#140e0b] text-[#e8d5be] flex flex-col justify-between selection:bg-[#c2382c] selection:text-white relative overflow-hidden font-sans">
      {/* Ancient patterned background overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#3a2016]/40 via-[#180f0a]/90 to-[#0c0705] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#b8860b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 border-b border-[#4a2e1d] bg-[#1a110c]/80 backdrop-blur px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8b0000] to-[#b8860b] p-0.5 shadow-lg border border-[#ffd700]/50 flex items-center justify-center">
            <span className="text-2xl">⚔️</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-[#f7d08a] to-[#d4af37] font-serif">
              三国杀 ONLINE
            </h1>
            <p className="text-xs text-[#a88a6d] tracking-wider">正统真人双人联网对战</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              soundManager.playClick();
              setShowRulesModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#2a1a12] border border-[#5a3820] text-xs hover:border-[#b8860b] text-[#f7d08a] transition shadow cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#ffd700]" />
            <span>兵法规则</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onToggleSound();
            }}
            className="p-2 rounded bg-[#2a1a12] border border-[#5a3820] text-[#f7d08a] hover:border-[#b8860b] transition cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
            aria-label={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#ffd700]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 w-full flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-start sm:justify-center">
        <div className="max-w-xl w-full mx-auto">
        {sessionNotice && !errorMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 text-xs text-center shadow-lg">
            ℹ️ {sessionNotice}
          </div>
        )}

        {errorMsg && (
          <div className="w-full mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700/80 text-red-200 text-sm text-center shadow-lg animate-shake">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Invite Link Card */}
        {invitedRoomCode && (
          <div className="w-full mb-5 p-4 rounded-2xl bg-gradient-to-r from-[#2c1510] via-[#24130d] to-[#2c1510] border-2 border-[#ffd700]/80 shadow-[0_0_30px_rgba(255,215,0,0.18)]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2 text-sm font-bold text-[#ffd700]">
                <Link2 className="w-4 h-4 shrink-0" />
                <span>好友房间邀请 · {invitedRoomCode}</span>
              </div>
              {onClearInvite && (
                <button
                  type="button"
                  onClick={onClearInvite}
                  className="p-1 rounded hover:bg-[#3a2016] text-[#a88a6d] hover:text-white cursor-pointer"
                  aria-label="关闭邀请提示"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!inviteInfo || inviteInfo.loading ? (
              <p className="text-xs text-[#d8c2aa]">正在查询房间【{invitedRoomCode}】状态...</p>
            ) : inviteInfo.exists && inviteInfo.canJoin ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-lg bg-[#2a1a12] border border-[#ffd700]/60 flex items-center justify-center text-xl shrink-0">
                    {inviteInfo.hostAvatar}
                  </div>
                  <div className="text-xs">
                    <p className="text-[#fff8e7] font-bold">
                      主公【{inviteInfo.hostName}】正在等你应战
                    </p>
                    <p className="text-[#a88a6d]">
                      确认下方你的大名后，点击按钮即可直接进房
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleJoinInvitedRoom}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#9b111e] to-[#d43d1a] border border-[#ffd700]/70 text-xs font-black text-white shadow-lg hover:brightness-110 transition cursor-pointer shrink-0"
                >
                  {loading ? '正在进入...' : `立即加入房间 (${invitedRoomCode})`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <p className="text-red-300">
                  {inviteInfo.exists
                    ? `房间【${invitedRoomCode}】${(inviteInfo.playerCount || 0) >= 2 ? '已满员（2/2）' : '对局已开始'}，暂时无法加入。`
                    : inviteInfo.error}
                </p>
                {onClearInvite && (
                  <button
                    type="button"
                    onClick={onClearInvite}
                    className="px-3 py-1.5 rounded-lg bg-[#2a1a12] border border-[#5a3820] text-[#f7d08a] hover:border-[#ffd700] cursor-pointer shrink-0"
                  >
                    返回大厅
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="w-full bg-gradient-to-b from-[#231610] to-[#1a100a] border-2 border-[#6d4624] rounded-2xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
          {/* Ornate corner ornaments */}
          <div className="absolute top-2 left-2 text-[#b8860b]/40 text-xs font-serif pointer-events-none">❖ 魏蜀吴群</div>
          <div className="absolute top-2 right-2 text-[#b8860b]/40 text-xs font-serif pointer-events-none">天下三分 ❖</div>

          {/* Player Profile Customization */}
          <div className="mb-8 p-4 rounded-xl bg-[#150d08] border border-[#4a2e1d] shadow-inner">
            <h2 className="text-sm font-bold text-[#b8860b] mb-3 flex items-center justify-between">
              <span>👤 玩家军令营身份</span>
              <span className="text-xs font-normal text-[#8d7055]">点击更换头像</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-xl bg-[#2a1a12] border-2 border-[#b8860b] flex items-center justify-center text-3xl shadow-lg">
                  {avatar}
                </div>
              </div>

              <div className="flex-1 w-full">
                <label htmlFor="lobby-username" className="block text-xs text-[#a88a6d] mb-1">主公/主帅尊称</label>
                <input
                  id="lobby-username"
                  type="text"
                  value={username}
                  onChange={e => saveProfile(e.target.value, avatar)}
                  maxLength={12}
                  className="w-full px-3 py-2 rounded-lg bg-[#0e0805] border border-[#5a3820] text-[#f7d08a] font-bold focus:border-[#ffd700] focus:outline-none transition text-sm"
                  placeholder="输入你的大名"
                />
              </div>
            </div>

            {/* Avatar Select Row */}
            <div className="mt-3 flex flex-wrap gap-2 justify-center pt-2 border-t border-[#3a2016]">
              {AVATAR_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    saveProfile(username, opt);
                  }}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border transition cursor-pointer ${
                    avatar === opt
                      ? 'border-[#ffd700] bg-[#3a2016] scale-110 shadow-md'
                      : 'border-[#4a2e1d] bg-[#1a110c] hover:border-[#8d7055]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Lobby Mode Actions */}
          <div className="space-y-4">
            {/* Quick Match */}
            <button
              onClick={handleQuickMatch}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#9b111e] via-[#b82e1f] to-[#d43d1a] border-2 border-[#ffd700]/70 text-[#fff8e7] font-black tracking-widest text-lg shadow-[0_4px_20px_rgba(184,46,31,0.5)] hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center space-x-3 cursor-pointer group"
            >
              <Swords className="w-6 h-6 text-[#ffd700] group-hover:rotate-12 transition-transform" />
              <span>一键快速真人匹配</span>
              <Sparkles className="w-5 h-5 text-[#ffd700]" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Create Room */}
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#2a1a12] to-[#1c110a] border border-[#8a5d3b] hover:border-[#ffd700] text-[#f7d08a] font-bold text-sm tracking-wider shadow-md hover:bg-[#321f15] transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <PlusCircle className="w-5 h-5 text-[#b8860b]" />
                <span>创建专属房间</span>
              </button>

              {/* Join by Code */}
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowJoinModal(true);
                }}
                disabled={loading}
                className="py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#2a1a12] to-[#1c110a] border border-[#8a5d3b] hover:border-[#ffd700] text-[#f7d08a] font-bold text-sm tracking-wider shadow-md hover:bg-[#321f15] transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5 text-[#b8860b]" />
                <span>输入房间码加入</span>
              </button>
            </div>
          </div>

          {/* Active Battle Chambers List */}
          {activeRooms.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#3a2016]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#b8860b] flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>军机营在线房间 ({activeRooms.length})</span>
                </span>
                <span className="text-[10px] text-[#8d7055]">点击房间码或按钮立即加入</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {activeRooms.map(rm => (
                  <div
                    key={rm.roomId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#150d08] border border-[#4a2e1d] hover:border-[#b8860b]/70 transition shadow"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#2a1a12] border border-[#ffd700]/50 flex items-center justify-center text-base">
                        {rm.hostAvatar}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#ffd700]">{rm.hostName} 的营房</span>
                          <span className="font-mono text-[11px] text-[#f7d08a] bg-[#2a1a12] px-1.5 py-0.5 rounded border border-[#5a3820]">
                            {rm.roomCode}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-[#a88a6d] mt-0.5">
                          <span className={rm.status === 'WAITING' ? 'text-green-400' : 'text-amber-400'}>
                            ● {rm.status === 'WAITING' ? '等待挑战中' : '鏖战中'}
                          </span>
                          <span>人数: {rm.playerCount}/2 人</span>
                        </div>
                      </div>
                    </div>

                    {rm.status === 'WAITING' && rm.playerCount < 2 ? (
                      <button
                        onClick={async () => {
                          soundManager.playClick();
                          if (!username.trim()) {
                            setErrorMsg('请输入你的大名！');
                            return;
                          }
                          setLoading(true);
                          try {
                            await onJoinRoom(rm.roomCode, username.trim(), avatar);
                          } catch (err: any) {
                            setErrorMsg(err.message || '加入失败');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#9b111e] to-[#b82e1f] hover:brightness-110 text-white font-bold text-xs tracking-wider border border-[#ffd700]/50 cursor-pointer shadow"
                      >
                        立即应战
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-500 px-2 py-1 bg-stone-900 rounded border border-stone-800">
                        {rm.playerCount >= 2 ? '营房已满' : '决战中'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-[#8d7055] space-y-1">
            <p>⚔️ 权威服务器裁决 · 真实两机联网 · 绝无虚假AI</p>
            <p>魏蜀吴群四国武将 · 完整锦囊装备 · 实时网络对抗</p>
          </div>
        </div>
        </div>
      </main>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1c120c] border-2 border-[#b8860b] rounded-2xl p-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-[#ffd700] mb-2 font-serif flex items-center space-x-2">
              <LogIn className="w-5 h-5" />
              <span>加入对决房间</span>
            </h3>
            <p className="text-xs text-[#a88a6d] mb-4">输入好友发给你的4位房间代码（如 8X2A）</p>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  placeholder="输入房间码"
                  className="w-full text-center text-2xl font-mono tracking-widest py-3 rounded-lg bg-[#0e0805] border-2 border-[#5a3820] focus:border-[#ffd700] text-[#ffd700] uppercase focus:outline-none"
                  autoFocus
                />
              </div>

              {errorMsg && <p className="text-xs text-red-400 text-center">{errorMsg}</p>}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-[#2a1a12] border border-[#5a3820] text-xs text-[#a88a6d] hover:text-white cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#9b111e] to-[#c2382c] text-xs font-bold text-white shadow-lg cursor-pointer hover:brightness-110"
                >
                  {loading ? '正在连线...' : '确认进入'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#1c120c] border-2 border-[#b8860b] rounded-2xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#4a2e1d] mb-4">
              <h3 className="text-lg font-bold text-[#ffd700] font-serif flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-[#b8860b]" />
                <span>三国杀双人对决兵书规则</span>
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-7 h-7 rounded-full bg-[#2a1a12] text-[#a88a6d] hover:text-white flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-[#d8c2aa] space-y-4 leading-relaxed font-sans">
              <div>
                <h4 className="font-bold text-[#f7d08a] mb-1 flex items-center space-x-1.5">
                  <span className="text-[#ffd700]">壹.</span>
                  <span>真实双人联机与准备</span>
                </h4>
                <p>
                  每局仅由两名真实玩家联网对战。双方均点击【准备】后，房主即可开启对局。游戏由服务器裁决，绝无虚假AI！
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#f7d08a] mb-1 flex items-center space-x-1.5">
                  <span className="text-[#ffd700]">贰.</span>
                  <span>武将与先手决定</span>
                </h4>
                <p>
                  游戏开始时，服务器在魏、蜀、吴、群四大阵营中为双方随机分发互不相同的经典武将，并以 50% 概率随机决定先手攻击方。双方各自摸 4 张初始手牌。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#f7d08a] mb-1 flex items-center space-x-1.5">
                  <span className="text-[#ffd700]">叁.</span>
                  <span>回合六阶段</span>
                </h4>
                <p>
                  每个回合严格按照【开始阶段】➔【判定阶段】➔【摸牌阶段】➔【出牌阶段】➔【弃牌阶段】➔【结束阶段】流转。
                  摸牌阶段默认摸2张牌；弃牌阶段若手牌数多于当前体力上限，必须弃置多余手牌。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#f7d08a] mb-1 flex items-center space-x-1.5">
                  <span className="text-[#ffd700]">肆.</span>
                  <span>攻防与锦囊</span>
                </h4>
                <p>
                  出牌阶段每回合限用一张【杀】（装备诸葛连弩或拥有张飞咆哮技能除外）。可使用【决斗】、【过河拆桥】、【顺手牵羊】、【无中生有】、【南蛮入侵】等锦囊。
                  受攻击方可在响应窗口打出【闪】或【无懈可击】抵消。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#f7d08a] mb-1 flex items-center space-x-1.5">
                  <span className="text-[#ffd700]">伍.</span>
                  <span>濒死急救与胜负判定</span>
                </h4>
                <p>
                  当体力降至 0 时进入濒死状态，须使用【桃】或【酒】自救。若未自救成功则阵亡，对手大获全胜！
                </p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#4a2e1d] text-center">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-6 py-2 rounded-lg bg-[#3a2016] border border-[#b8860b] text-xs text-[#ffd700] hover:bg-[#5a3820] font-bold cursor-pointer"
              >
                知晓军令，重返大厅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-3 text-center text-xs text-[#7d6045] border-t border-[#2a1a12]">
        三国杀 Online 双人竞技版 · 魏蜀吴群英豪对决
      </footer>
    </div>
  );
};
