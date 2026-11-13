import test from 'node:test';
import assert from 'node:assert/strict';
import { SanGuoShaEngine } from './engine';

test('game initialization creates valid match with 2 players and dealt cards', () => {
  const p1 = { userId: 'u1', username: '曹丞相', avatar: '👑' };
  const p2 = { userId: 'u2', username: '汉献帝', avatar: '🐉' };

  const game = SanGuoShaEngine.initGame(p1, p2);

  assert.equal(game.status, 'PLAYING');
  assert.equal(game.players.length, 2);
  assert.equal(game.players[0].hand.length, 4);
  assert.equal(game.players[1].hand.length, 4);
  assert.notEqual(game.players[0].hero.id, game.players[1].hero.id);
  assert.ok(game.currentTurnPlayerId === 'u1' || game.currentTurnPlayerId === 'u2');
});

test('hand card privacy strictly hides opponent cards', () => {
  const p1 = { userId: 'u1', username: '玩家A', avatar: '⚔️' };
  const p2 = { userId: 'u2', username: '玩家B', avatar: '🛡️' };

  const game = SanGuoShaEngine.initGame(p1, p2);

  // Client view for Player 1
  const clientView1 = SanGuoShaEngine.sanitizeForPlayer(game, 'u1');
  assert.equal(clientView1.myPlayer.userId, 'u1');
  assert.equal(clientView1.myPlayer.hand.length, 4);
  assert.equal(clientView1.opponentPlayer.userId, 'u2');
  assert.equal(clientView1.opponentPlayer.handCount, 4);
  // Ensure opponent hand is NOT in the public object
  assert.equal((clientView1.opponentPlayer as any).hand, undefined);

  // Client view for Player 2
  const clientView2 = SanGuoShaEngine.sanitizeForPlayer(game, 'u2');
  assert.equal(clientView2.myPlayer.userId, 'u2');
  assert.equal(clientView2.opponentPlayer.userId, 'u1');
  assert.equal(clientView2.opponentPlayer.handCount, 4);
  assert.equal((clientView2.opponentPlayer as any).hand, undefined);
});

test('surrender immediately declares opponent winner', () => {
  const p1 = { userId: 'u1', username: '玩家A', avatar: '⚔️' };
  const p2 = { userId: 'u2', username: '玩家B', avatar: '🛡️' };

  const game = SanGuoShaEngine.initGame(p1, p2);
  SanGuoShaEngine.surrender(game, 'u1');

  assert.equal(game.status, 'ENDED');
  assert.equal(game.winnerId, 'u2');
  assert.ok(game.endReason?.includes('投降认输'));
});
