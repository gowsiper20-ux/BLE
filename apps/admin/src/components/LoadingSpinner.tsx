import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner" role="status" aria-label={label || 'Loading'}>
      <div className={`loading-spinner__ring loading-spinner__ring--${size}`} />
      {label && <span className="loading-spinner__label">{label}</span>}
    </div>
  );
}
