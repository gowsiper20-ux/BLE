import PageHeader from '../components/PageHeader';
import { useApi } from '../hooks/useApi';
import type { ApiResponse } from '../types';
import type { DirectoryStudentResult } from '../services/studentService';

export default function BatchesPage() {
  const { data: response, loading, error } =
    useApi<ApiResponse<DirectoryStudentResult>>('/api/auth/directory-students?limit=1');
  const coverage = response?.data;
  const batches = [...(coverage?.filters.batches || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="batches-page">
      <PageHeader
        title="Verified Admission Batches"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Batches' },
        ]}
      />
      <div role="status" style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
        Admission batches are listed only when supplied by a configured authoritative directory attribute for verified IT student identities. Admission batch is not current year of study. Legacy and seeded batch rows are intentionally excluded.
      </div>
      {error && <div role="alert" style={{ color: '#A11' }}>Verified batch coverage is unavailable: {error.message || 'API error'}.</div>}
      {loading ? (
        <div role="status">Loading verified admission batches...</div>
      ) : batches.length ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {batches.map((batch) => (
              <li key={batch} style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>{batch}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="status" style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 8 }}>
          {coverage?.classificationConfigured
            ? coverage.academicAttributesConfigured
              ? coverage.batchAttributeConfigured
                ? 'No verified admission batch values were supplied for the synchronized IT student identities.'
                : 'No authoritative admission-batch Graph attribute is configured.'
              : 'No authoritative admission-batch Graph attribute is configured.'
            : 'Verified IT student group IDs and approved membership semantics are not configured.'}
        </div>
      )}
    </div>
  );
}
