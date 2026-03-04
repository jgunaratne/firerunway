/**
 * Shared helper to resolve a Clerk ID to a Supabase user_id.
 * Falls back gracefully when Clerk is not configured (dev/demo mode).
 */

import { createServerClient } from '@/lib/supabase';

export async function resolveUserId(clerkId: string | null): Promise<string | null> {
  if (!clerkId) return null;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single();

    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

/**
 * Extract clerkId from request headers or query params.
 * API routes can pass it as ?clerkId=xxx or x-clerk-id header.
 */
export function extractClerkId(request: Request): string | null {
  const url = new URL(request.url);
  return (
    url.searchParams.get('clerkId') ??
    request.headers.get('x-clerk-id') ??
    null
  );
}
