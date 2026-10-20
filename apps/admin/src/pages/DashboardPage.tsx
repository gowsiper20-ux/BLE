import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { api } from '../services/api';
import './DashboardPage.css';

interface DashboardStats {
  classes: number;
  students: number;
  staff: number;
  subjects: number;
  scheduledToday: number;
  activeSessions: number;
  completedToday: number;
  cancelledToday: number;
}

interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  actor: string;
  type: 'success' | 'info' | 'warning' | 'error';
  time: string;
  timestamp: string;
}

const STAT_KEYS: Array<keyof DashboardStats> = [
  'classes',
  'students',
  'staff',
  'subjects',
  'scheduledToday',
  'activeSessions',
  'completedToday',
  'cancelledToday',
];

function readDashboardStats(response: unknown): DashboardStats {
  if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true || !('data' in response) || !response.data || typeof response.data !== 'object') {
    throw new Error('The dashboard returned an invalid statistics response.');
  }
  const data = response.data as Record<string, unknown>;
  if (!STAT_KEYS.every((key) => Number.isSafeInteger(data[key]) && (data[key] as number) >= 0)) {
    throw new Error('The dashboard returned invalid statistics values.');
  }
  return {
    classes: Number(data.classes),
    students: Number(data.students),
    staff: Number(data.staff),
    subjects: Number(data.subjects),
    scheduledToday: Number(data.scheduledToday),
    activeSessions: Number(data.activeSessions),
    completedToday: Number(data.completedToday),
    cancelledToday: Number(data.cancelledToday),
  };
}

function readActivity(response: unknown): ActivityItem[] {
  if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true || !('data' in response) || !Array.isArray(response.data)) {
    throw new Error('The dashboard returned an invalid activity response.');
  }
  const items = response.data;
  if (!items.every((item) =>
    item !== null &&
    typeof item === 'object' &&
    'id' in item && typeof item.id === 'string' &&
    'action' in item && typeof item.action === 'string' &&
    'detail' in item && typeof item.detail === 'string' &&
    'actor' in item && typeof item.actor === 'string' &&
    'time' in item && typeof item.time === 'string' &&
    'timestamp' in item && typeof item.timestamp === 'string' &&
    'type' in item && ['success', 'info', 'warning', 'error'].includes(String(item.type))
  )) {
    throw new Error('The dashboard returned invalid activity entries.');
  }
  return items as ActivityItem[];
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'Unable to load dashboard data.';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityError, setActivityError] = useState('');

  const fetchDashboardData = useCallback(() => Promise.allSettled([
      api.get<unknown>('/api/dashboard/stats').then(readDashboardStats),
      api.get<unknown>('/api/dashboard/recent-activity').then(readActivity),
  ]), []);

  const applyDashboardData = useCallback(([statsResult, activityResult]: Awaited<ReturnType<typeof fetchDashboardData>>) => {
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    else {
      setStats(null);
      setError(errorMessage(statsResult.reason));
    }
    if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
    else {
      setActivity([]);
      setActivityError(errorMessage(activityResult.reason));
    }
    setLoading(false);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setActivityError('');
    applyDashboardData(await fetchDashboardData());
  }, [applyDashboardData, fetchDashboardData]);

  useEffect(() => {
    let isCurrent = true;
    void fetchDashboardData().then((results) => {
      if (isCurrent) applyDashboardData(results);
    });
    return () => {
      isCurrent = false;
    };
  }, [applyDashboardData, fetchDashboardData]);

  const metrics = stats ? [
    { label: 'Active Students', value: stats.students },
    { label: 'Active Faculty / Staff', value: stats.staff },
    { label: 'Active Classes', value: stats.classes },
    { label: 'Active Subjects', value: stats.subjects },
    { label: 'Scheduled Today', value: stats.scheduledToday },
    { label: 'Active Attendance Sessions', value: stats.activeSessions },
    { label: 'Completed Today', value: stats.completedToday },
    { label: 'Cancelled Today', value: stats.cancelledToday },
  ] : [];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Dashboard' }]}
        subtitle="Sona College of Technology — Department of Information Technology"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/students')}>Students</Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/staff')}>Faculty / Staff</Button>
          </div>
        }
      />

      {error && (
        <div role="alert" style={{ padding: 12, background: '#FDECEC', color: '#A11', borderRadius: 6 }}>
          Dashboard statistics are unavailable. {error} <button type="button" onClick={() => void loadDashboard()}>Retry</button>
        </div>
      )}
      {loading && !stats && <p role="status">Loading dashboard data…</p>}

      {stats && (
        <div className="dashboard-page__cards">
          {metrics.map((metric) => (
            <Card key={metric.label} className="summary-card">
              <div className="summary-card__header"><span className="summary-card__label">{metric.label}</span></div>
              <div className="summary-card__value">{metric.value.toLocaleString()}</div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !stats && !error && <p role="status">Dashboard data is unavailable.</p>}

      <Card className="dashboard-page__section">
        <h2 style={{ margin: '0 0 16px' }}>Recent activity</h2>
        {activityError ? (
          <p role="alert">Recent activity is unavailable. {activityError}</p>
        ) : activity.length === 0 ? (
          <p role="status">{loading ? 'Loading activity…' : 'No administrative activity has been recorded.'}</p>
        ) : (
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-list__item" key={item.id}>
                <span className={`activity-list__dot activity-list__dot--${item.type}`} aria-hidden="true" />
                <div className="activity-list__content">
                  <span className="activity-list__action">{item.action}</span>
                  <span className="activity-list__detail">{item.detail} · {item.actor}</span>
                </div>
                <time className="activity-list__time" dateTime={item.timestamp}>{item.time}</time>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
