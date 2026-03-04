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
    <div className={`${hover ? 'glass-card-hover' : 'glass-card'} ${padding} ${className}`}>
      {children}
    </div>
  );
}
