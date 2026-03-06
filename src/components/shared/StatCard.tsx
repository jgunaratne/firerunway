'use client';

import { ReactNode } from 'react';
import Card from './Card';

interface StatCardProps {
  label: string;
  value: ReactNode;
  subtitle?: string;
  delay?: number;
  valueColor?: string;
  glowClass?: string;
}

export default function StatCard({ label, value, subtitle, delay = 0, valueColor, glowClass = 'glow-text' }: StatCardProps) {
  return (
    <Card delay={delay}>
      <p className="stat-label mb-2">{label}</p>
      <p
        className={`stat-value ${glowClass}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      {subtitle && <p className="text-sm text-text-secondary mt-2 leading-relaxed">{subtitle}</p>}
    </Card>
  );
}
