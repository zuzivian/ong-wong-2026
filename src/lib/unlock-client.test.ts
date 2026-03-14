import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeInviteCode,
  UNLOCKED_INVITE_CODE_STORAGE_KEY,
} from './unlock-client.ts';

test('normalizeInviteCode trims whitespace, removes separators, and uppercases', () => {
  assert.equal(normalizeInviteCode(' ab-12 cd '), 'AB12CD');
});

test('normalizeInviteCode returns an empty string when only separators are provided', () => {
  assert.equal(normalizeInviteCode('  - -  '), '');
});

test('unlock storage key remains stable', () => {
  assert.equal(UNLOCKED_INVITE_CODE_STORAGE_KEY, 'wedding_unlocked_invite_code');
});
