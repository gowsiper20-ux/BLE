import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { timetableService } from '../services/timetableService';
import { useToast } from '../hooks/useToast';
import type { TimetableOverride } from '../types';

export default function OverridesPage() {
  const [overrides, setOverrides] = useState<TimetableOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timetableService.getOverrides();
      setOverrides(res.data);
    } catch {
      showToast('error', 'Failed to fetch overrides');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const columns = [
    { key: 'overrideDate', label: 'Date', render: (val: any) => new Date(val).toLocaleDateString() },
    { key: 'className', label: 'Class' },
    { key: 'periodName', label: 'Period' },
    { key: 'originalSubjectName', label: 'Subject' },
    { key: 'replacementStaffName', label: 'Replacement Staff' },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ];

  return (
    <div className="overrides-page">
      <PageHeader
        title="Timetable Overrides"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Timetable', path: '/timetable' },
          { label: 'Overrides' }
        ]}
        subtitle="Manage temporary timetable changes"
      />

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3>All Overrides</h3>
          <button className="btn btn-primary" disabled>+ Add Override</button>
        </div>
        <DataTable
          data={overrides}
          columns={columns}
          loading={loading}
          keyField="id"
        />
      </div>
    </div>
  );
}
