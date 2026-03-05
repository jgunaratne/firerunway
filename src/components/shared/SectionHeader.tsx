import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="section-title mb-0">{title}</h3>
      {action && <div>{action}</div>}
    </div>
  );
}
