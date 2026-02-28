'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🔥</span>
          <h1 className="font-display text-2xl text-text-primary mt-3">Get started</h1>
          <p className="text-sm text-text-secondary mt-1">Create your FireRunway account</p>
        </div>
        <SignUp
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
