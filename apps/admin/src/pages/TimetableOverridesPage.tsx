import PlaceholderPage from './PlaceholderPage';

export default function TimetableOverridesPage() {
  return (
    <PlaceholderPage
      title="Timetable Overrides"
      breadcrumbs={[
        { label: 'Home', path: '/dashboard' },
        { label: 'Timetable' },
        { label: 'Overrides' },
      ]}
      icon="overrides"
      description="Manage temporary timetable changes without modifying the permanent schedule. Useful for substitutions, special events, and one-off changes."
      features={[
        'Create temporary overrides',
        'Substitute staff for specific dates',
        'Change rooms temporarily',
        'View override history',
        'Override does not modify permanent timetable',
      ]}
    />
  );
}
