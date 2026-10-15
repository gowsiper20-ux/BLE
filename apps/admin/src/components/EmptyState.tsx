import Icon from './Icon';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: string;
  message: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon = 'search', message, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={40} />
      </div>
      <h3 className="empty-state__message">{message}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
