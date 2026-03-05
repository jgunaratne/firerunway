interface FilterPillsProps {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
}

export default function FilterPills({ options, selected, onChange }: FilterPillsProps) {
  return (
    <div className="flex items-center gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`filter-pill${selected === opt.value ? ' active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
