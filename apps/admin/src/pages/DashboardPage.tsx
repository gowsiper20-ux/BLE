import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import type { ApiResponse } from '../types';
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

interface TimetableItem {
  id: string;
  period: string;
  periodNumber: number;
  time: string;
  class: string;
  subject: string;
  subjectCode: string;
  subjectName: string;
  staff: string;
  status: string;
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

const QUICK_ACTIONS = [
  { label: 'Add Student', icon: 'add', path: '/students' },
  { label: 'Import Students', icon: 'import', path: '/students' },
  { label: 'Add Staff', icon: 'add', path: '/staff' },
  { label: 'Create Timetable', icon: 'timetable', path: '/timetable' },
  { label: 'View Attendance', icon: 'view', path: '/attendance' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: statsResponse, loading: statsLoading, refetch: refetchStats } =
    useApi<ApiResponse<DashboardStats>>('/api/dashboard/stats');

  const { data: todayTimetableResponse, loading: timetableLoading, refetch: refetchTimetable } =
    useApi<ApiResponse<TimetableItem[]>>('/api/dashboard/today-timetable');

  const { data: recentActivityResponse, loading: activityLoading, refetch: refetchActivity } =
    useApi<ApiResponse<ActivityItem[]>>('/api/dashboard/recent-activity');

  const { data: dirStatusResponse, refetch: refetchDirStatus } =
    useApi<ApiResponse<any>>('/api/auth/directory-status');

  const stats = statsResponse?.data;
  const todaysTimetable = todayTimetableResponse?.data || [];
  const recentActivities = recentActivityResponse?.data || [];
  const dirStatus = dirStatusResponse?.data;

  const handleSyncDirectory = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.post<ApiResponse<any>>('/api/auth/sync-directory', {});
      if (res.success && res.data) {
        setSyncMessage(`✓ ${res.data.message}`);
        refetchStats();
        refetchTimetable();
        refetchActivity();
        refetchDirStatus();
      } else {
        setSyncMessage('Directory sync completed.');
      }
    } catch (err: any) {
      setSyncMessage(err?.message || 'Directory synchronization failed.');
    } finally {
      setSyncing(false);
    }
  };

  const SUMMARY_CARDS = [
    { label: 'IT Classes', value: (stats?.classes ?? 0).toString(), icon: 'academic', trend: 'Active Sections' },
    { label: 'Students', value: (stats?.students ?? 0).toString(), icon: 'students', trend: 'Enrolled' },
    { label: 'Staff', value: (stats?.staff ?? 0).toString(), icon: 'staff', trend: 'Registered' },
    { label: 'Subjects', value: (stats?.subjects ?? 0).toString(), icon: 'subjects', trend: 'Active' },
    { label: 'Scheduled Today', value: (stats?.scheduledToday ?? 0).toString(), icon: 'timetable', trend: 'Sessions' },
  ];

  const ATTENDANCE_CARDS = [
    { label: 'Active Sessions', value: (stats?.activeSessions ?? 0).toString(), icon: 'attendance', trend: 'Currently Running' },
    { label: 'Completed Today', value: (stats?.completedToday ?? 0).toString(), icon: 'success', trend: 'Sessions' },
    { label: 'Cancelled Today', value: (stats?.cancelledToday ?? 0).toString(), icon: 'error', trend: 'Sessions' },
  ];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Dashboard' },
        ]}
        subtitle="Sona College of Technology — Department of Information Technology"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncDirectory}
              disabled={syncing}
            >
              <Icon name="sync" size={16} />
              {syncing ? 'Syncing Microsoft Directory...' : 'Sync Microsoft Directory'}
            </Button>
          </div>
        }
      />

      {syncMessage && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '6px',
            background: syncMessage.startsWith('✓') ? '#E8F5E9' : '#FFF3E0',
            color: syncMessage.startsWith('✓') ? '#2E7D32' : '#E65100',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{syncMessage}</span>
          <button
            onClick={() => setSyncMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Directory Status Badge */}
      {dirStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: '#F1F6FC',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#1E3A8A',
          }}
        >
          <div>
            <strong>College Domain:</strong> @{dirStatus.domain || 'sonatech.ac.in'} &bull;{' '}
            <strong>Directory Source:</strong> {dirStatus.mode === 'LIVE_GRAPH' ? 'Live Microsoft Graph' : 'Entra ID College Directory'} &bull;{' '}
            <strong>Identities Linked:</strong> {dirStatus.linkedIdentities} &bull;{' '}
            <strong>Total Faculty:</strong> {dirStatus.totalStaff} &bull;{' '}
            <strong>Total Students:</strong> {dirStatus.totalStudents}
          </div>
          <span style={{ color: '#059669', fontWeight: 600 }}>Active</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-page__cards">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.label} className="summary-card">
            <div className="summary-card__header">
              <span className="summary-card__label">{card.label}</span>
              <div className="summary-card__icon-wrap">
                <Icon name={card.icon} size={18} />
              </div>
            </div>
            <div className="summary-card__value">
              {statsLoading ? '...' : card.value}
            </div>
            {card.trend && <span className="summary-card__trend">{card.trend}</span>}
          </Card>
        ))}
      </div>

      <div className="dashboard-page__cards" style={{ marginTop: '24px' }}>
        {ATTENDANCE_CARDS.map((card) => (
          <Card
            key={card.label}
            className="summary-card"
            style={{
              background: card.label === 'Active Sessions' ? 'var(--primary-light)' : undefined,
            }}
          >
            <div className="summary-card__header">
              <span className="summary-card__label">{card.label}</span>
              <div className="summary-card__icon-wrap">
                <Icon name={card.icon} size={18} />
              </div>
            </div>
            <div
              className="summary-card__value"
              style={{
                color: card.label === 'Active Sessions' ? 'var(--primary-color)' : undefined,
              }}
            >
              {statsLoading ? '...' : card.value}
            </div>
            {card.trend && <span className="summary-card__trend">{card.trend}</span>}
          </Card>
        ))}
      </div>

      <div className="dashboard-page__grid">
        {/* Today's Timetable */}
        <Card className="dashboard-page__section" padding="none">
          <div className="section-header">
            <h3 className="section-header__title">Today's Timetable</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/timetable')}>
              View All
            </Button>
          </div>
          <div className="timetable-preview">
            {timetableLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading today's schedule...
              </div>
            ) : todaysTimetable.length > 0 ? (
              <table className="timetable-preview__table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysTimetable.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.period}</td>
                      <td className="timetable-preview__time">{entry.time}</td>
                      <td>{entry.class}</td>
                      <td>
                        <strong>{entry.subject}</strong>
                      </td>
                      <td>{entry.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No classes scheduled for today.
              </div>
            )}
          </div>
        </Card>

        {/* Right Column */}
        <div className="dashboard-page__right-col">
          {/* Quick Actions */}
          <Card className="dashboard-page__section">
            <h3 className="section-header__title" style={{ marginBottom: '16px' }}>
              Quick Actions
            </h3>
            <div className="quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  className="quick-action"
                  onClick={() => navigate(action.path)}
                >
                  <div className="quick-action__icon">
                    <Icon name={action.icon} size={16} />
                  </div>
                  <span className="quick-action__label">{action.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="dashboard-page__section" padding="none">
            <div className="section-header">
              <h3 className="section-header__title">Recent Activity</h3>
            </div>
            <ul className="activity-list">
              {activityLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading recent activity...
                </div>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((item) => (
                  <li key={item.id} className="activity-list__item">
                    <div className={`activity-list__dot activity-list__dot--${item.type}`} />
                    <div className="activity-list__content">
                      <span className="activity-list__action">{item.action}</span>
                      <span className="activity-list__detail">{item.detail}</span>
                    </div>
                    <span className="activity-list__time">{item.time}</span>
                  </li>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No recent activity logged.
                </div>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
