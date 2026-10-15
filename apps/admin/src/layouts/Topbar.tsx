import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import './Topbar.css';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/academic-years': 'Academic Years',
  '/batches': 'Batches',
  '/regulations': 'Regulations',
  '/classes': 'Classes',
  '/students': 'Students',
  '/staff': 'Staff',
  '/subjects': 'Subjects',
  '/timetable': 'Timetable',
  '/timetable/overrides': 'Timetable Overrides',
  '/attendance': 'Attendance',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const title = pageTitles[location.pathname] || 'Dashboard';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <h2 className="topbar__title">{title}</h2>
      </div>

      <div className="topbar__right">
        <button className="topbar__icon-btn" aria-label="Notifications">
          <Icon name="notification" size={20} />
          <span className="topbar__notification-dot" />
        </button>

        <div className="topbar__divider" />

        <div className="topbar__profile">
          <div className="topbar__avatar">
            <Icon name="user" size={18} />
          </div>
          <div className="topbar__profile-info">
            <span className="topbar__profile-name">{user?.name || 'Administrator'}</span>
            <span className="topbar__profile-role">{user?.roles?.[0] || 'Admin'}</span>
          </div>
        </div>

        <button className="topbar__icon-btn topbar__logout" aria-label="Logout" onClick={handleLogout}>
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  );
}
