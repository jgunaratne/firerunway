'use client';

import { SignUp } from '@clerk/nextjs';
import { Flame } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Flame size={40} className="text-accent mx-auto" />
          <h1 className="font-display text-2xl text-text-primary mt-3">Get started</h1>
          <p className="page-subtitle">Create your FireRunway account</p>
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
