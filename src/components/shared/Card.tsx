'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  padding?: string;
}

export default function Card({ children, className = '', hover = false, padding = 'p-6' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-bg-surface ${hover ? 'hover:bg-bg-elevated transition-colors' : ''} ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
