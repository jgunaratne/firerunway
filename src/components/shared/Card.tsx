'use client';

import { ReactNode, useRef, useCallback } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  padding?: string;
}

export default function Card({ children, className = '', hover = false, padding = 'p-6' }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--spotlight-x', `${x}px`);
    cardRef.current.style.setProperty('--spotlight-y', `${y}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`${hover ? 'glass-card-hover' : 'glass-card'} spotlight-card ${padding} ${className}`}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
