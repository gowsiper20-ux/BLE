import { Link } from 'react-router-dom';
import type { BreadcrumbItem } from '../types';
import Icon from './Icon';
import './Breadcrumb.css';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        {items.map((item, index) => (
          <li key={index} className="breadcrumb__item">
            {index > 0 && (
              <Icon name="chevron-right" size={14} className="breadcrumb__separator" />
            )}
            {item.path && index < items.length - 1 ? (
              <Link to={item.path} className="breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumb__current">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
