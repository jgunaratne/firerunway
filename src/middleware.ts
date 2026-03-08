import { NextResponse } from 'next/server';

// Firebase auth is verified per-route in API handlers.
// Middleware only handles redirects for unauthenticated users on protected pages.
export default function middleware() {
  // All routes pass through — auth is handled client-side (AuthProvider redirect)
  // and server-side (verifyIdToken in API routes)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
