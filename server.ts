import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Room, ChatMessage } from './src/game/types';
import { SanGuoShaEngine } from './src/game/engine';

const app = express();
app.use(express.json());

// In-memory database of rooms and active sessions (backed by local snapshot for process restarts)
const rooms = new Map<string, Room>();
const codeToRoomId = new Map<string, string>();
const SNAPSHOT_FILE = path.join(os.tmpdir(), 'sgs-rooms-snapshot.json');

function loadRoomsSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return;
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rooms)) return;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const room of parsed.rooms as Room[]) {
      if (!room?.roomId || !room?.roomCode || (room.createdAt && room.createdAt < cutoff)) continue;
      for (const p of Object.values(room.players || {})) {
        p.online = false;
      }
      rooms.set(room.roomId, room);
      codeToRoomId.set(room.roomCode, room.roomId);
    }
  } catch {
    // Ignore corrupt snapshot
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSaveSnapshot() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const payload = JSON.stringify({ rooms: Array.from(rooms.values()) });
      fs.writeFileSync(SNAPSHOT_FILE, payload, 'utf-8');
    } catch {
      // Ignore disk write errors
    }
  }, 150);
}

loadRoomsSnapshot();

interface SseClient {
  userId: string;
  roomId: string;
  res: Response;
}

const sseClients = new Set<SseClient>();

// Server-side authoritative GameEvents table
export interface ServerGameEvent {
  id: string;
  gameId: string;
  roomId: string;
  text: string;
  type: 'INFO' | 'PLAY' | 'DAMAGE' | 'HEAL' | 'SKILL' | 'JUDGE' | 'EQUIP';
  timestamp: number;
}
const gameEventsTable: ServerGameEvent[] = [];

function syncGameEvents(game: any, roomId: string) {
  for (const log of game.eventLogs) {
    if (!gameEventsTable.some(e => e.id === log.id)) {
      gameEventsTable.push({
        id: log.id,
        gameId: game.gameId,
        roomId: roomId,
        text: log.text,
        type: log.type,
        timestamp: log.timestamp,
      });
    }
  }
}

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.game) {
    syncGameEvents(room.game, roomId);
  }
  scheduleSaveSnapshot();

  const roomSummary = {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    players: Object.values(room.players),
    playerCount: Object.keys(room.players).length,
    chatMessages: room.chatMessages.slice(-20),
    hasGame: !!room.game,
  };

  sseClients.forEach(client => {
    if (client.roomId === roomId) {
      try {
        // Send public room state
        client.res.write(`event: room_state\ndata: ${JSON.stringify(roomSummary)}\n\n`);

        // If game is active, send sanitized personal game state and authoritative events
        if (room.game) {
          try {
            const sanitized = SanGuoShaEngine.sanitizeForPlayer(room.game, client.userId);
            client.res.write(`event: game_state\ndata: ${JSON.stringify(sanitized)}\n\n`);

            const events = gameEventsTable.filter(e => e.gameId === room.game!.gameId);
            client.res.write(`event: game_events\ndata: ${JSON.stringify(events)}\n\n`);
          } catch (e) {
            // Player might not be one of the 2 in the match
          }
        }
      } catch (err) {
        // Client disconnected
      }
    }
  });
}

// Keep-alive heartbeat every 15s to prevent timeouts
setInterval(() => {
  sseClients.forEach(client => {
    try {
      client.res.write(': keepalive\n\n');
    } catch {
      sseClients.delete(client);
    }
  });
}, 15000);

// --- SSE Endpoint ---
app.get('/api/stream', (req: Request, res: Response) => {
  const { roomId, userId } = req.query as { roomId?: string; userId?: string };

  if (!roomId || !userId) {
    res.status(400).json({ error: '缺少 roomId 或 userId' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const client: SseClient = { userId, roomId, res };
  sseClients.add(client);

  const room = rooms.get(roomId);
  if (room && room.players[userId]) {
    room.players[userId].online = true;
    room.players[userId].lastActive = Date.now();
    broadcastRoom(roomId);
  }

  req.on('close', () => {
    sseClients.delete(client);
    const r = rooms.get(roomId);
    if (r && r.players[userId]) {
      r.players[userId].online = false;
      broadcastRoom(roomId);
    }
  });
});

// --- Room Endpoints ---

// Create Room
app.post('/api/room/create', (req: Request, res: Response) => {
  const { username, avatar } = req.body;
  if (!username) {
    res.status(400).json({ error: '请输入玩家昵称' });
    return;
  }

  let code = generateRoomCode();
  while (codeToRoomId.has(code)) {
    code = generateRoomCode();
  }

  const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);

  const room: Room = {
    roomId,
    roomCode: code,
    hostId: userId,
    players: {
      [userId]: {
        userId,
        username,
        avatar: avatar || '👑',
        ready: false,
        online: true,
        lastActive: Date.now(),
      },
    },
    status: 'WAITING',
    chatMessages: [],
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);
  scheduleSaveSnapshot();

  res.json({ success: true, roomId, roomCode: code, userId });
});

// Join Room by Code
app.post('/api/room/join', (req: Request, res: Response) => {
  const { roomCode, username, avatar, existingUserId } = req.body;
  if (!roomCode || !username) {
    res.status(400).json({ error: '请输入房间码和玩家昵称' });
    return;
  }

  const normalizedCode = roomCode.trim().toUpperCase();
  const roomId = codeToRoomId.get(normalizedCode);
  if (!roomId) {
    res.status(404).json({ error: '房间不存在，请确认房间码' });
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: '房间不存在' });
    return;
  }

  // Reconnection check
  if (existingUserId && room.players[existingUserId]) {
    room.players[existingUserId].online = true;
    room.players[existingUserId].lastActive = Date.now();
    broadcastRoom(roomId);
    res.json({ success: true, roomId, roomCode: room.roomCode, userId: existingUserId });
    return;
  }

  // Capacity check
  const playerList = Object.values(room.players);
  if (playerList.length >= 2) {
    res.status(400).json({ error: '该房间已满员（最多2人）' });
    return;
  }

  if (room.status === 'PLAYING') {
    res.status(400).json({ error: '该房间对局已开始，无法加入' });
    return;
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  room.players[userId] = {
    userId,
    username,
    avatar: avatar || '⚔️',
    ready: false,
    online: true,
    lastActive: Date.now(),
  };

  broadcastRoom(roomId);
  res.json({ success: true, roomId, roomCode: room.roomCode, userId });
});

// Quick Random Match
app.post('/api/room/quick-match', (req: Request, res: Response) => {
  const { username, avatar } = req.body;
  if (!username) {
    res.status(400).json({ error: '请输入玩家昵称' });
    return;
  }

  // Search for an existing waiting room with exactly 1 player
  for (const room of rooms.values()) {
    if (room.status === 'WAITING' && Object.keys(room.players).length === 1) {
      const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
      room.players[userId] = {
        userId,
        username,
        avatar: avatar || '⚔️',
        ready: false,
        online: true,
        lastActive: Date.now(),
      };
      broadcastRoom(room.roomId);
      res.json({ success: true, roomId: room.roomId, roomCode: room.roomCode, userId });
      return;
    }
  }

  // None found -> create a new waiting room
  let code = generateRoomCode();
  while (codeToRoomId.has(code)) {
    code = generateRoomCode();
  }
  const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);

  const room: Room = {
    roomId,
    roomCode: code,
    hostId: userId,
    players: {
      [userId]: {
        userId,
        username,
        avatar: avatar || '👑',
        ready: false,
        online: true,
        lastActive: Date.now(),
      },
    },
    status: 'WAITING',
    chatMessages: [],
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);
  scheduleSaveSnapshot();

  res.json({ success: true, roomId, roomCode: code, userId });
});

// Ready / Unready
app.post('/api/room/ready', (req: Request, res: Response) => {
  const { roomId, userId, ready } = req.body;
  const room = rooms.get(roomId);
  if (!room || !room.players[userId]) {
    res.status(404).json({ error: '未找到房间或玩家' });
    return;
  }

  room.players[userId].ready = !!ready;
  broadcastRoom(roomId);
  res.json({ success: true });
});

// Start Game
app.post('/api/room/start', (req: Request, res: Response) => {
  const { roomId, userId } = req.body;
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: '房间不存在' });
    return;
  }

  if (room.hostId !== userId) {
    res.status(403).json({ error: '只有房主可以开始游戏' });
    return;
  }

  const playerList = Object.values(room.players);
  if (playerList.length !== 2) {
    res.status(400).json({ error: '必须有两名真人玩家才能开始游戏' });
    return;
  }

  const unready = playerList.find(p => !p.ready);
  if (unready) {
    res.status(400).json({ error: `玩家【${unready.username}】尚未准备，无法开始` });
    return;
  }

  // Initialize server game state with two random heroes and random first player
  const game = SanGuoShaEngine.initGame(playerList[0], playerList[1]);
  game.roomId = roomId;

  room.game = game;
  room.status = 'PLAYING';

  broadcastRoom(roomId);
  res.json({ success: true });
});

// Leave Room
app.post('/api/room/leave', (req: Request, res: Response) => {
  const { roomId, userId } = req.body;
  const room = rooms.get(roomId);
  if (!room) {
    res.json({ success: true });
    return;
  }

  delete room.players[userId];

  // If host leaves and other player remains, promote to host
  const remaining = Object.values(room.players);
  if (remaining.length === 0) {
    codeToRoomId.delete(room.roomCode);
    rooms.delete(roomId);
    scheduleSaveSnapshot();
  } else {
    if (room.hostId === userId) {
      room.hostId = remaining[0].userId;
    }
    if (room.game && room.status === 'PLAYING') {
      room.game.status = 'ENDED';
      room.game.winnerId = remaining[0].userId;
      room.game.endReason = '对手已退出房间，对局提前结束。';
    }
    broadcastRoom(roomId);
  }

  res.json({ success: true });
});

// List all active rooms for lobby
app.get('/api/rooms', (_req: Request, res: Response) => {
  const list = Array.from(rooms.values()).map(r => {
    const hostPlayer = r.players[r.hostId];
    return {
      roomId: r.roomId,
      roomCode: r.roomCode,
      hostName: hostPlayer?.username || '主公',
      hostAvatar: hostPlayer?.avatar || '👑',
      playerCount: Object.keys(r.players).length,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
  res.json({ rooms: list.filter(r => r.playerCount > 0) });
});

// Lookup a single room by roomCode for invite link previews
app.get('/api/room/lookup', (req: Request, res: Response) => {
  const rawCode = (req.query.roomCode as string | undefined) || '';
  const normalizedCode = rawCode.trim().toUpperCase();
  if (!normalizedCode) {
    res.status(400).json({ exists: false, error: '缺少房间码' });
    return;
  }

  const roomId = codeToRoomId.get(normalizedCode);
  const room = roomId ? rooms.get(roomId) : undefined;
  if (!room) {
    res.json({
      exists: false,
      roomCode: normalizedCode,
      error: `未找到房间【${normalizedCode}】：可能房主已离开、服务已休眠重启，或双方打开的不是同一个分享链接。`,
    });
    return;
  }

  const hostPlayer = room.players[room.hostId];
  const playerCount = Object.keys(room.players).length;
  res.json({
    exists: true,
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostName: hostPlayer?.username || '主公',
    hostAvatar: hostPlayer?.avatar || '👑',
    playerCount,
    status: room.status,
    canJoin: room.status === 'WAITING' && playerCount < 2,
  });
});

// Get Room & Game State (for reconnection or initial fetch)
app.get('/api/room/state', (req: Request, res: Response) => {
  const { roomId, userId } = req.query as { roomId?: string; userId?: string };
  if (!roomId) {
    res.status(400).json({ error: '缺少 roomId' });
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: '房间不存在' });
    return;
  }

  const roomSummary = {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    players: Object.values(room.players),
    playerCount: Object.keys(room.players).length,
    chatMessages: room.chatMessages.slice(-20),
    hasGame: !!room.game,
  };

  let gameState = null;
  if (room.game && userId) {
    try {
      gameState = SanGuoShaEngine.sanitizeForPlayer(room.game, userId);
    } catch {
      // User not in game
    }
  }

  res.json({ room: roomSummary, game: gameState });
});

// Chat & Quick Messages
app.post('/api/chat/send', (req: Request, res: Response) => {
  const { roomId, userId, username, text, isEmoji } = req.body;
  const room = rooms.get(roomId);
  if (!room || !text) {
    res.status(400).json({ error: '消息发送失败' });
    return;
  }

  const msg: ChatMessage = {
    id: 'msg_' + Math.random().toString(36).substring(2, 8),
    roomId,
    userId,
    username: username || '玩家',
    text: text.slice(0, 100),
    timestamp: Date.now(),
    isEmoji: !!isEmoji,
  };

  room.chatMessages.push(msg);
  if (room.chatMessages.length > 50) room.chatMessages.shift();

  broadcastRoom(roomId);
  res.json({ success: true });
});

// Game Actions
app.post('/api/game/action', (req: Request, res: Response) => {
  const { roomId, userId, actionType, cardId, targetId, options, action, skillId, cardIds } = req.body;
  const room = rooms.get(roomId);
  if (!room || !room.game) {
    res.status(404).json({ error: '对局不存在' });
    return;
  }

  try {
    switch (actionType) {
      case 'PLAY_CARD':
        SanGuoShaEngine.playCard(room.game, userId, cardId, targetId, options);
        break;
      case 'RESPOND_CARD':
        SanGuoShaEngine.respondCard(room.game, userId, cardId, action);
        break;
      case 'USE_SKILL':
        SanGuoShaEngine.useSkill(room.game, userId, skillId, cardIds);
        break;
      case 'END_PLAY':
        SanGuoShaEngine.endPlayPhase(room.game, userId);
        break;
      case 'DISCARD':
        SanGuoShaEngine.discardCards(room.game, userId, cardIds || []);
        break;
      case 'SURRENDER':
        SanGuoShaEngine.surrender(room.game, userId);
        break;
      default:
        res.status(400).json({ error: '未知游戏操作类型' });
        return;
    }

    broadcastRoom(roomId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || '操作执行失败' });
  }
});

// Authenticated GameEvents endpoint syncing with GameEvents table
app.get('/api/game/events', (req: Request, res: Response) => {
  const { gameId, roomId } = req.query as { gameId?: string; roomId?: string };
  let events = gameEventsTable;
  if (gameId) {
    events = events.filter(e => e.gameId === gameId);
  } else if (roomId) {
    events = events.filter(e => e.roomId === roomId);
  }
  res.json({ events: events.slice(-100) });
});

// Vite & Static Serve Setup
async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`三国杀 Online 游戏服务器已在 http://0.0.0.0:${PORT} 启动完成！`);
  });
}

startServer();
