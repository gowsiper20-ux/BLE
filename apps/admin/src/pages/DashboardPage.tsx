import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useApi } from '../hooks/useApi';
import type { ApiResponse, ClassSection } from '../types';
import './DashboardPage.css';

// ──────────────────────────────────────────────
// TODO: Replace with API calls when backend is implemented
// ──────────────────────────────────────────────
const MOCK_RECENT_ACTIVITY: any[] = [];
const MOCK_TODAYS_TIMETABLE: any[] = [];

const QUICK_ACTIONS = [
  { label: 'Add Student', icon: 'add', path: '/students' },
  { label: 'Import Students', icon: 'import', path: '/students' },
  { label: 'Add Staff', icon: 'add', path: '/staff' },
  { label: 'Create Timetable', icon: 'timetable', path: '/timetable' },
  { label: 'View Attendance', icon: 'view', path: '/attendance' },
];
// ──────────────────────────────────────────────

export default function DashboardPage() {
  const { data: classesResponse } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  const { data: studentsResponse } = useApi<ApiResponse<any>>('/api/students?limit=1');
  const { data: staffResponse } = useApi<ApiResponse<any>>('/api/staff?limit=1');
  const { data: subjectStatsResponse } = useApi<ApiResponse<any>>('/api/subjects/stats');
  const { data: timetableStatsResponse } = useApi<ApiResponse<any>>('/api/timetable/stats');
  const { data: attendanceStatsResponse } = useApi<ApiResponse<any>>('/api/attendance/sessions/stats');

  const itClassesCount = classesResponse?.data?.filter(c => c.status === 'ACTIVE').length || 0;

  const SUMMARY_CARDS = [
    { label: 'IT Classes', value: itClassesCount.toString(), icon: 'academic', trend: 'Active Sections' },
    { label: 'Students', value: (studentsResponse?.data?.pagination?.total || 0).toString(), icon: 'students', trend: 'Enrolled' },
    { label: 'Staff', value: (staffResponse?.data?.pagination?.total || 0).toString(), icon: 'staff', trend: 'Registered' },
    { label: 'Subjects', value: (subjectStatsResponse?.data?.active || 0).toString(), icon: 'subjects', trend: 'Active' },
    { label: 'Scheduled Today', value: (timetableStatsResponse?.data?.todayEntries || 0).toString(), icon: 'timetable', trend: 'Sessions' },
  ];

  const ATTENDANCE_CARDS = [
    { label: 'Active Sessions', value: (attendanceStatsResponse?.data?.activeToday || 0).toString(), icon: 'attendance', trend: 'Currently Running' },
    { label: 'Completed Today', value: (attendanceStatsResponse?.data?.completedToday || 0).toString(), icon: 'success', trend: 'Sessions' },
    { label: 'Cancelled Today', value: (attendanceStatsResponse?.data?.cancelledToday || 0).toString(), icon: 'error', trend: 'Sessions' },
  ];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Dashboard' },
        ]}
        subtitle="Welcome to the Smart Attendance Admin Dashboard"
      />

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
            <div className="summary-card__value">{card.value}</div>
            {card.trend && <span className="summary-card__trend">{card.trend}</span>}
          </Card>
        ))}
      </div>

      <div className="dashboard-page__cards" style={{ marginTop: '24px' }}>
        {ATTENDANCE_CARDS.map((card) => (
          <Card key={card.label} className="summary-card" style={{ background: card.label === 'Active Sessions' ? 'var(--primary-light)' : undefined }}>
            <div className="summary-card__header">
              <span className="summary-card__label">{card.label}</span>
              <div className="summary-card__icon-wrap">
                <Icon name={card.icon} size={18} />
              </div>
            </div>
            <div className="summary-card__value" style={{ color: card.label === 'Active Sessions' ? 'var(--primary-color)' : undefined }}>{card.value}</div>
            {card.trend && <span className="summary-card__trend">{card.trend}</span>}
          </Card>
        ))}
      </div>

      <div className="dashboard-page__grid">
        {/* Today's Timetable */}
        <Card className="dashboard-page__section" padding="none">
          <div className="section-header">
            <h3 className="section-header__title">Today's Timetable</h3>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          <div className="timetable-preview">
            {MOCK_TODAYS_TIMETABLE.length > 0 ? (
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
                  {MOCK_TODAYS_TIMETABLE.map((entry) => (
                    <tr key={entry.period}>
                      <td>{entry.period}</td>
                      <td className="timetable-preview__time">{entry.time}</td>
                      <td>{entry.class}</td>
                      <td><strong>{entry.subject}</strong></td>
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
            <h3 className="section-header__title" style={{ marginBottom: '16px' }}>Quick Actions</h3>
            <div className="quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} className="quick-action">
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
              {MOCK_RECENT_ACTIVITY.length > 0 ? (
                MOCK_RECENT_ACTIVITY.map((item) => (
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
                  No recent activity.
                </div>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
