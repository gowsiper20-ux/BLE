import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { timetableService } from '../services/timetableService';
import { useToast } from '../hooks/useToast';
import type { Period } from '../types';

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timetableService.getPeriods();
      setPeriods(res.data);
    } catch {
      showToast('error', 'Failed to fetch periods');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const columns = [
    { key: 'periodNumber', label: 'Period' },
    { key: 'name', label: 'Name' },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time' },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ];

  const actions = () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button className="btn btn-secondary btn-sm" disabled>Edit</button>
    </div>
  );

  return (
    <div className="periods-page">
      <PageHeader
        title="Periods Management"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Timetable', path: '/timetable' },
          { label: 'Periods' }
        ]}
        subtitle="Manage daily teaching periods"
      />

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3>All Periods</h3>
          <button className="btn btn-primary" disabled>+ Add Period</button>
        </div>
        <DataTable
          data={periods}
          columns={columns}
          actions={actions}
          loading={loading}
          keyField="id"
        />
      </div>
    </div>
  );
}
