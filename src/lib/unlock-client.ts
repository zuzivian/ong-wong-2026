export const UNLOCKED_INVITE_CODE_STORAGE_KEY = 'wedding_unlocked_invite_code';

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}
