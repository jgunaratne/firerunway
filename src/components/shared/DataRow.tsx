import { formatCurrency } from '@/lib/calculations';

interface DataRowProps {
  label: string;
  value: number | string;
  indent?: boolean;
  bold?: boolean;
  highlight?: boolean;
}

export default function DataRow({ label, value, indent = false, bold = false, highlight = false }: DataRowProps) {
  const rowClass = `data-row${bold ? ' bold' : ''}${highlight ? ' highlight' : ''}`;
  const labelClass = `data-row-label${indent ? ' indent' : ''}`;

  return (
    <div className={rowClass}>
      <span className={labelClass}>{label}</span>
      <span className="data-row-value">
        {typeof value === 'number' ? formatCurrency(value) : value}
      </span>
    </div>
  );
}
