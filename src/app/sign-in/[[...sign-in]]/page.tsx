'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🔥</span>
          <h1 className="font-display text-2xl text-text-primary mt-3">Welcome back</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to FireRunway</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-bg-surface border border-border shadow-2xl',
            },
          }}
        />
      </div>
    </div>
  );
}
