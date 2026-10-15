import './Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function Card({ children, className = '', padding = 'md', onClick, title, subtitle, style }: CardProps) {
  return (
    <div
      className={`card card--pad-${padding} ${onClick ? 'card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: '16px' }}>
          {title && <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>}
          {subtitle && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
