'use client';

import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-accent shadow-glow-sm" />
        <h3 className="section-title mb-0">{title}</h3>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
