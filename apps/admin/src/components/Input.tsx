import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export default function Input({
  label,
  error,
  helpText,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`input-group ${error ? 'input-group--error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-group__label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className="input-group__input"
        {...props}
      />
      {error && <span className="input-group__error">{error}</span>}
      {helpText && !error && <span className="input-group__help">{helpText}</span>}
    </div>
  );
}
