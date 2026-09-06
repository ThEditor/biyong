function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GuestSession {
  isGuest: true;
  guestId: string;
  createdAt: string;
}

export function createGuestSession(existingGuestId?: string): GuestSession {
  return {
    isGuest: true,
    guestId: existingGuestId ?? `guest_${generateUUID()}`,
    createdAt: new Date().toISOString(),
  };
}

export function isGuestSession(session: unknown): session is GuestSession {
  return typeof session === 'object' && session !== null && (session as any).isGuest === true;
}
