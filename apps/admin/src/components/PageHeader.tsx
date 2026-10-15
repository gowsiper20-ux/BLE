import Breadcrumb from './Breadcrumb';
import type { BreadcrumbItem } from '../types';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  subtitle?: string;
}

export default function PageHeader({ title, breadcrumbs, actions, subtitle }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__left">
        {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
