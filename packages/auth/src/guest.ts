import { randomUUID } from 'node:crypto';

export interface GuestSession {
  isGuest: true;
  guestId: string;
  createdAt: string;
}

export function createGuestSession(existingGuestId?: string): GuestSession {
  return {
    isGuest: true,
    guestId: existingGuestId ?? `guest_${randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
}

export function isGuestSession(session: unknown): session is GuestSession {
  return typeof session === 'object' && session !== null && (session as any).isGuest === true;
}
