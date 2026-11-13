import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoomCode,
  extractRoomCodeFromSearch,
  buildInviteUrl,
  isPrivatePreviewHost,
} from './invite';

test('normalizeRoomCode trims, uppercases, and strips invalid characters', () => {
  assert.equal(normalizeRoomCode(' 8x2a '), '8X2A');
  assert.equal(normalizeRoomCode('ab-12!'), 'AB12');
  assert.equal(normalizeRoomCode(''), '');
  assert.equal(normalizeRoomCode(null), '');
});

test('extractRoomCodeFromSearch reads room or code query parameter', () => {
  assert.equal(extractRoomCodeFromSearch('?room=8x2a'), '8X2A');
  assert.equal(extractRoomCodeFromSearch('?foo=1&code=k9p3'), 'K9P3');
  assert.equal(extractRoomCodeFromSearch('?foo=bar'), '');
  assert.equal(extractRoomCodeFromSearch(''), '');
});

test('buildInviteUrl generates clean shareable URL with room query param', () => {
  assert.equal(
    buildInviteUrl('https://ais-pre-abc.us-east1.run.app/', '/', '8x2a'),
    'https://ais-pre-abc.us-east1.run.app/?room=8X2A'
  );
  assert.equal(
    buildInviteUrl('http://localhost:3000', '/', ''),
    'http://localhost:3000/'
  );
});

test('isPrivatePreviewHost detects private ais-dev preview hostname', () => {
  assert.equal(isPrivatePreviewHost('ais-dev-xyz.us-east1.run.app'), true);
  assert.equal(isPrivatePreviewHost('ais-pre-xyz.us-east1.run.app'), false);
  assert.equal(isPrivatePreviewHost('localhost'), false);
});
