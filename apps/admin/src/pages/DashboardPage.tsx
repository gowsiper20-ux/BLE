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

interface DirectoryStatus {
  configured: boolean;
  source: string;
  storedIdentityRows: number;
  totalSynchronizedUsers: number;
  verifiedItStudentIdentities: number;
  verifiedItFacultyStaffIdentities: number;
  verifiedGroupClassifications: boolean;
  conflictingGroupClassifications: number;
  unclassifiedUsers: number;
  disabledAccounts: number;
  verifiedBatchValues: number;
  verifiedClassValues: number;
  academicAttributesConfigured: boolean;
  membershipMode: string | null;
  studentGroupIdsConfigured: boolean;
  staffGroupIdsConfigured: boolean;
  lastSuccessfulFullSync: string | null;
  lastSyncCounts: { pagesProcessed: number; usersScanned: number } | null;
  latestAttempt: {
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    pagesProcessed: number;
    usersScanned: number;
    failurePage: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
  failures: Array<{ startedAt: string; failurePage: number | null; errorCode: string | null; errorMessage: string | null }>;
  classification: string;
}

const QUICK_ACTIONS = [
  { label: 'View Students', icon: 'students', path: '/students' },
  { label: 'View Staff', icon: 'staff', path: '/staff' },
  { label: 'Create Timetable', icon: 'timetable', path: '/timetable' },
  { label: 'View Attendance', icon: 'view', path: '/attendance' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: statsResponse, loading: statsLoading, error: statsError, refetch: refetchStats } =
    useApi<ApiResponse<DashboardStats>>('/api/dashboard/stats');

  const { data: todayTimetableResponse, loading: timetableLoading, error: timetableError, refetch: refetchTimetable } =
    useApi<ApiResponse<TimetableItem[]>>('/api/dashboard/today-timetable');

  const { data: recentActivityResponse, loading: activityLoading, error: activityError, refetch: refetchActivity } =
    useApi<ApiResponse<ActivityItem[]>>('/api/dashboard/recent-activity');

  const { data: dirStatusResponse, error: dirStatusError, refetch: refetchDirStatus } =
    useApi<ApiResponse<DirectoryStatus>>('/api/auth/directory-status');

  const stats = statsResponse?.data;
  const todaysTimetable = todayTimetableResponse?.data || [];
  const recentActivities = recentActivityResponse?.data || [];
  const dirStatus = dirStatusResponse?.data;
  const latestSyncFailure = dirStatus?.failures[0] &&
    (!dirStatus.lastSuccessfulFullSync ||
      new Date(dirStatus.failures[0].startedAt).getTime() > new Date(dirStatus.lastSuccessfulFullSync).getTime())
    ? dirStatus.failures[0]
    : null;

  const handleSyncDirectory = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.post<{ success: boolean; message: string; totalScanned: number }>('/api/auth/sync-directory', {});
      if (res.success) {
        setSyncMessage(`✓ ${res.message}`);
        refetchStats();
        refetchTimetable();
        refetchActivity();
        refetchDirStatus();
      } else {
        setSyncMessage(res.message || 'Directory synchronization did not complete.');
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Directory synchronization failed.';
      setSyncMessage(message);
    } finally {
      setSyncing(false);
    }
  };

  const SUMMARY_CARDS = [
    { label: 'Unverified class rows', value: (stats?.classes ?? 0).toString(), icon: 'academic', trend: 'Legacy academic data' },
    { label: 'Unverified student rows', value: (stats?.students ?? 0).toString(), icon: 'students', trend: 'Legacy application data' },
    { label: 'Unverified staff rows', value: (stats?.staff ?? 0).toString(), icon: 'staff', trend: 'Legacy application data' },
    { label: 'Unverified subject rows', value: (stats?.subjects ?? 0).toString(), icon: 'subjects', trend: 'Legacy academic data' },
    { label: 'Stored timetable rows', value: (stats?.scheduledToday ?? 0).toString(), icon: 'timetable', trend: 'Not verified against an official source' },
  ];

  const ATTENDANCE_CARDS = [
    { label: 'Stored active sessions', value: (stats?.activeSessions ?? 0).toString(), icon: 'attendance', trend: 'Application records; provenance unverified' },
    { label: 'Stored completed sessions', value: (stats?.completedToday ?? 0).toString(), icon: 'success', trend: 'Application records; provenance unverified' },
    { label: 'Stored cancelled sessions', value: (stats?.cancelledToday ?? 0).toString(), icon: 'error', trend: 'Application records; provenance unverified' },
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
            <strong>Directory source:</strong> {dirStatus.source} ·{' '}
            {dirStatus.lastSuccessfulFullSync ? <>
            <strong>Synchronized tenant users:</strong> {dirStatus.totalSynchronizedUsers} ·{' '}
            <strong>Verified IT students:</strong> {dirStatus.studentGroupIdsConfigured && dirStatus.membershipMode ? dirStatus.verifiedItStudentIdentities : 'Unavailable — group classification not configured'} ·{' '}
            <strong>Verified IT faculty/staff:</strong> {dirStatus.staffGroupIdsConfigured && dirStatus.membershipMode ? dirStatus.verifiedItFacultyStaffIdentities : 'Unavailable — group classification not configured'} ·{' '}
            <strong>Unclassified:</strong> {dirStatus.unclassifiedUsers} ·{' '}
            <strong>Conflicting classifications:</strong> {dirStatus.conflictingGroupClassifications} ·{' '}
            <strong>Disabled accounts:</strong> {dirStatus.disabledAccounts}
            </> : 'No successful full Entra sync; directory counts are unavailable, not zero.'}
          </div>
          {dirStatus.lastSuccessfulFullSync && <div>
            <strong>Verified batch/class values:</strong> {dirStatus.studentGroupIdsConfigured && dirStatus.membershipMode
              ? `${dirStatus.verifiedBatchValues}/${dirStatus.verifiedClassValues}`
              : 'Unavailable — student-group classification not configured'} ·{' '}
            <strong>Stored identity rows (not necessarily in last successful sync):</strong> {dirStatus.storedIdentityRows} ·{' '}
            <strong>Membership semantics:</strong> {dirStatus.membershipMode || 'not approved/configured'} ·{' '}
            <strong>Last successful full sync:</strong> {dirStatus.lastSuccessfulFullSync
              ? new Date(dirStatus.lastSuccessfulFullSync).toLocaleString()
              : 'Never'}
          </div>}
          {dirStatus.lastSyncCounts && (
            <div>
              <strong>Last successful full-sync snapshot:</strong> {dirStatus.lastSyncCounts.usersScanned} users across {dirStatus.lastSyncCounts.pagesProcessed} pages
            </div>
          )}
          <div>
            <strong>Latest sync attempt:</strong> {dirStatus.latestAttempt?.status || 'None'}
            {dirStatus.latestAttempt?.status === 'RUNNING' && ` · ${dirStatus.latestAttempt.pagesProcessed} pages, ${dirStatus.latestAttempt.usersScanned} users processed`}
          </div>
          <div><strong>Classification:</strong> {dirStatus.classification}</div>
          {latestSyncFailure && (
            <div role="alert" style={{ color: '#A11' }}>
              <strong>Latest sync failure:</strong> {latestSyncFailure.errorCode || 'unknown'}
              {latestSyncFailure.failurePage ? ` on page ${latestSyncFailure.failurePage}` : ''} — {latestSyncFailure.errorMessage || 'No failure details recorded.'}
            </div>
          )}
          <span style={{ color: dirStatus.configured ? '#059669' : '#B45309', fontWeight: 600 }}>
            {dirStatusError
              ? 'Directory status unavailable'
              : dirStatus.configured
                ? latestSyncFailure ? 'Latest sync failed' : dirStatus.lastSuccessfulFullSync ? 'Last full sync recorded' : 'Configured; no successful sync recorded'
                : 'Not configured'}
          </span>
        </div>
      )}
      {dirStatusError && !dirStatus && (
        <div role="alert" style={{ padding: '12px 16px', marginBottom: '20px', background: '#FDECEC', color: '#A11' }}>
          Directory status is unavailable; synchronization and classification counts cannot be reported.
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
              {statsError ? 'Unavailable' : statsLoading ? '...' : card.value}
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
              {statsError ? 'Unavailable' : statsLoading ? '...' : card.value}
            </div>
            {card.trend && <span className="summary-card__trend">{card.trend}</span>}
          </Card>
        ))}
      </div>

      <div className="dashboard-page__grid">
        {/* Today's Timetable */}
        <Card className="dashboard-page__section" padding="none">
          <div className="section-header">
            <h3 className="section-header__title">Existing Timetable (source unverified)</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/timetable')}>
              View All
            </Button>
          </div>
          <div className="timetable-preview">
            {timetableLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading today's schedule...
              </div>
            ) : timetableError ? (
              <div role="alert" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
                Today&apos;s timetable could not be loaded.
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
            <div role="note" style={{ padding: '0 16px 12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Application audit activity only; it is not an Entra audit feed and may refer to unverified legacy records.
            </div>
            <ul className="activity-list">
              {activityLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading recent activity...
                </div>
              ) : activityError ? (
                <div role="alert" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
                  Recent activity could not be loaded.
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
