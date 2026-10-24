import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Input from '../components/Input';
import Select from '../components/Select';
import Button from '../components/Button';
import Card from '../components/Card';
import { useToast } from '../hooks/useToast';
import { attendanceService } from '../services/attendanceService';
import type { AttendanceSession, SessionStats, TableColumn } from '../types';

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [statusFilter, setStatusFilter] = useState<string>('');
  const requestId = useRef(0);
  const inFlight = useRef(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchSessions = useCallback(async (allowConcurrent = false) => {
    if (inFlight.current && !allowConcurrent) return;
    inFlight.current = true;
    const currentRequest = ++requestId.current;
    try {
      const [sessRes, statsRes] = await Promise.all([
        attendanceService.getSessions({ date: dateFilter, status: statusFilter }),
        attendanceService.getStats(dateFilter)
      ]);
      if (requestId.current === currentRequest) {
        setSessions(sessRes.data);
        setStats(statsRes.data);
        setRefreshError('');
        setLastUpdated(new Date());
      }
    } catch (err: unknown) {
      if (requestId.current === currentRequest) {
        const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Failed to fetch attendance sessions.';
        setRefreshError(message);
        showToast('error', message);
      }
    } finally {
      if (requestId.current === currentRequest) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, [dateFilter, showToast, statusFilter]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void fetchSessions(true), 0);
    const interval = window.setInterval(() => void fetchSessions(), 15_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      requestId.current += 1;
      inFlight.current = false;
    };
  }, [fetchSessions]);

  const columns = useMemo<TableColumn<AttendanceSession>[]>(() => [
    { key: 'sessionDate', label: 'Date', render: (val: any) => new Date(val).toLocaleDateString() },
    { key: 'periodName', label: 'Time', render: (_: any, row) => `${row.periodName} (${row.periodStartTime?.substring(0,5)} - ${row.periodEndTime?.substring(0,5)})` },
    { key: 'className', label: 'Class', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'staffName', label: 'Staff' },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => {
        const variants: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
          SCHEDULED: 'default',
          ACTIVE: 'info',
          COMPLETED: 'success',
          CANCELLED: 'danger',
          EXPIRED: 'warning'
        };
        return <Badge variant={variants[val] || 'default'}>{val}</Badge>;
      }
    }
  ], []);

  const actions = (row: AttendanceSession) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/attendance/sessions/${row.id}`)}>
        View
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Attendance Sessions"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Attendance', path: '/attendance' },
          { label: 'Sessions' }
        ]}
      />

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          <Card title="Today's Sessions" subtitle="Total">
            <div style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.totalToday}</div>
          </Card>
          <Card title="Active Sessions" subtitle="Currently running">
            <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary-color)' }}>{stats.activeToday}</div>
          </Card>
          <Card title="Completed" subtitle="Today">
            <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--success-color)' }}>{stats.completedToday}</div>
          </Card>
          <Card title="Cancelled" subtitle="Today">
            <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--danger-color)' }}>{stats.cancelledToday}</div>
          </Card>
        </div>
      )}
      <div aria-live="polite" style={{ color: refreshError ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
        {refreshError
          ? `Attendance data could not be refreshed. The displayed values may be stale. ${refreshError}`
          : lastUpdated
            ? `Last refreshed ${lastUpdated.toLocaleTimeString()} · refreshes every 15 seconds`
            : loading
              ? 'Loading attendance data…'
              : 'Attendance data has not been refreshed.'}
      </div>

      <Card title="Sessions List">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ width: '200px' }}>
            <Input 
              type="date"
              label="Date"
              value={dateFilter}
              onChange={(e) => {
                setLoading(true);
                setDateFilter(e.target.value);
              }}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(val) => {
                setLoading(true);
                setStatusFilter(val);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'SCHEDULED', label: 'SCHEDULED' },
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'COMPLETED', label: 'COMPLETED' },
                { value: 'CANCELLED', label: 'CANCELLED' },
                { value: 'EXPIRED', label: 'EXPIRED' }
              ]}
            />
          </div>
        </div>

        <DataTable
          data={sessions}
          columns={columns}
          actions={actions}
          loading={loading}
          keyField="id"
        />
      </Card>
    </div>
  );
}
