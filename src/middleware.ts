import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only import and use Clerk middleware when the publishable key is set.
// In production without Clerk, all routes are public.
export default async function middleware(request: NextRequest) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkKey) {
    // No Clerk configured — allow all requests through
    return NextResponse.next();
  }

  // Dynamically import Clerk middleware only when key exists
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

  const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/onboarding(.*)',
    '/api/cron(.*)',
    '/api/debug(.*)',
  ]);

  const handler = clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  });

  return handler(request, {} as never);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
