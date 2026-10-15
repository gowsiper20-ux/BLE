import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Icon from '../components/Icon';
import type { BreadcrumbItem } from '../types';
import './PlaceholderPage.css';

interface PlaceholderPageProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  icon: string;
  description: string;
  features?: string[];
}

/**
 * Reusable placeholder shell for pages not yet implemented.
 * Provides consistent structure so every route renders properly.
 */
export default function PlaceholderPage({
  title,
  breadcrumbs,
  icon,
  description,
  features = [],
}: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <PageHeader title={title} breadcrumbs={breadcrumbs} />

      <Card className="placeholder-page__card">
        <div className="placeholder-page__content">
          <div className="placeholder-page__icon">
            <Icon name={icon} size={48} />
          </div>
          <h2 className="placeholder-page__title">{title}</h2>
          <p className="placeholder-page__desc">{description}</p>

          {features.length > 0 && (
            <div className="placeholder-page__features">
              <h4 className="placeholder-page__features-title">Planned Features</h4>
              <ul className="placeholder-page__features-list">
                {features.map((feature, i) => (
                  <li key={i} className="placeholder-page__feature">
                    <Icon name="check" size={14} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="placeholder-page__badge">Coming Soon</div>
        </div>
      </Card>
    </div>
  );
}
