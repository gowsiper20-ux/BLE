import PageHeader from '../components/PageHeader';
import { useApi } from '../hooks/useApi';
import type { ApiResponse } from '../types';
import type { DirectoryStudentResult } from '../services/studentService';

export default function ClassesPage() {
  const { data: response, loading, error } =
    useApi<ApiResponse<DirectoryStudentResult>>('/api/auth/directory-students?limit=1');
  const coverage = response?.data;
  const classes = [...(coverage?.filters.classes || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="classes-page">
      <PageHeader
        title="Verified IT Classes"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Classes' },
        ]}
      />
      <div role="status" style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
        Classes are listed only when supplied by a configured authoritative directory attribute for verified IT student identities. No sections are generated from naming patterns, years of study, or assumed labels. Legacy and seeded class rows are intentionally excluded.
      </div>
      {error && <div role="alert" style={{ color: '#A11' }}>Verified class coverage is unavailable: {error.message || 'API error'}.</div>}
      {loading ? (
        <div role="status">Loading verified IT classes...</div>
      ) : classes.length ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {classes.map((className) => (
              <li key={className} style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>{className}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="status" style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 8 }}>
          {coverage?.classificationConfigured
            ? coverage.academicAttributesConfigured
              ? coverage.classAttributeConfigured
                ? 'No verified class values were supplied for the synchronized IT student identities.'
                : 'No authoritative class Graph attribute is configured.'
              : 'No authoritative class Graph attribute is configured.'
            : 'Verified IT student group IDs and approved membership semantics are not configured.'}
        </div>
      )}
    </div>
  );
}
