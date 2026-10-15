import Icon from './Icon';
import Button from './Button';
import './ErrorState.css';

interface ErrorStateProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state__icon">
        <Icon name="error" size={40} />
      </div>
      <h3 className="error-state__message">{message}</h3>
      <p className="error-state__description">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
