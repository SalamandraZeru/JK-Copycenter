import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const UPLOAD_SESSION_COOKIE = 'jk_upload_session';
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GuestUploadSession {
  token: string;
  hash: string;
  isNew: boolean;
}

export function hashUploadSession(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function readGuestUploadSession(request: NextRequest): GuestUploadSession | null {
  const token = request.cookies.get(UPLOAD_SESSION_COOKIE)?.value || '';
  if (!SESSION_TOKEN_PATTERN.test(token)) return null;
  return { token, hash: hashUploadSession(token), isNew: false };
}

export function ensureGuestUploadSession(request: NextRequest): GuestUploadSession {
  const existing = readGuestUploadSession(request);
  if (existing) return existing;
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashUploadSession(token), isNew: true };
}

export function attachGuestUploadCookie(
  response: NextResponse,
  session: GuestUploadSession,
): void {
  if (!session.isNew) return;
  response.cookies.set({
    name: UPLOAD_SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60,
  });
}
