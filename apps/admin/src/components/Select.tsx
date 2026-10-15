import './Select.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

export default function Select({
  label,
  error,
  options,
  placeholder,
  id,
  value,
  onChange,
  className = '',
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`select-group ${error ? 'select-group--error' : ''} ${className}`}>
      {label && (
        <label htmlFor={selectId} className="select-group__label">
          {label}
        </label>
      )}
      <div className="select-group__wrapper">
        <select
          id={selectId}
          className="select-group__select"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-group__arrow">▾</span>
      </div>
      {error && <span className="select-group__error">{error}</span>}
    </div>
  );
}
