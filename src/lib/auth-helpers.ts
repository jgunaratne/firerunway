/**
 * Shared auth helpers for resolving Firebase UID → Supabase user.
 */

import { createServerClient } from '@/lib/supabase';
import { verifyIdToken } from '@/lib/firebase-admin';

/**
 * Resolve a Firebase UID to a Supabase user id.
 */
export async function resolveUserId(firebaseUid: string | null): Promise<string | null> {
  if (!firebaseUid) return null;

  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract user ID from request.
 * Supports: Authorization Bearer token (Firebase), uid query param.
 */
export async function extractUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const decoded = await verifyIdToken(authHeader);
    if (decoded?.uid) return decoded.uid;
  }

  const url = new URL(request.url);
  return url.searchParams.get('uid') ?? null;
}
