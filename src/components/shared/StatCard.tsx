'use client';

import { ReactNode } from 'react';
import Card from './Card';

interface StatCardProps {
  label: string;
  value: ReactNode;
  subtitle?: string;
  delay?: number;
  valueColor?: string;
}

export default function StatCard({ label, value, subtitle, delay = 0, valueColor }: StatCardProps) {
  return (
    <Card delay={delay}>
      <p className="stat-label">{label}</p>
      <p className="stat-value mt-1" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
    </Card>
  );
}
