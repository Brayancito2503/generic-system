import { NextResponse } from 'next/server';
import { destroySessionCookie } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return destroySessionCookie(response);
}