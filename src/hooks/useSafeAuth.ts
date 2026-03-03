'use client';

/**
 * Safe wrapper around @clerk/nextjs useAuth.
 * Returns { userId: null } when ClerkProvider is not available
 * (e.g., when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set).
 */
export function useSafeAuth(): { userId: string | null | undefined } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, react-hooks/rules-of-hooks
    const { useAuth } = require('@clerk/nextjs');
    return useAuth();
  } catch {
    return { userId: null };
  }
}
