export function normalizeRoomCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function extractRoomCodeFromSearch(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('room') || params.get('code') || '';
    return normalizeRoomCode(raw);
  } catch {
    return '';
  }
}

export function buildInviteUrl(origin: string, pathname: string, roomCode: string): string {
  const cleanCode = normalizeRoomCode(roomCode);
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!cleanCode) return `${cleanOrigin}${cleanPath}`;
  return `${cleanOrigin}${cleanPath}?room=${encodeURIComponent(cleanCode)}`;
}

export function isPrivatePreviewHost(hostname: string): boolean {
  return hostname.includes('ais-dev-');
}
