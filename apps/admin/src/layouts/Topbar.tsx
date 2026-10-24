import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import './Topbar.css';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/academic-years': 'Academic Years',
  '/batches': 'Batches',
  '/regulations': 'Regulations',
  '/classes': 'Classes',
  '/students': 'Students Directory',
  '/staff': 'Faculty & Staff',
  '/subjects': 'Subjects',
  '/timetable': 'Timetable',
  '/timetable/overrides': 'Timetable Overrides',
  '/attendance': 'Attendance',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
  '/periods': 'Periods',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (/^\/staff\/[^/]+\/timetable$/.test(pathname)) return 'Staff Timetable';
  if (/^\/staff\/[^/]+$/.test(pathname)) return 'Staff Details';
  if (/^\/subjects\/[^/]+$/.test(pathname)) return 'Subject Details';
  if (/^\/attendance\/sessions\/[^/]+$/.test(pathname)) return 'Attendance Session';
  return 'Dashboard';
}

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title = getPageTitle(location.pathname);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      showToast('error', 'Could not invalidate your server session. Check the connection and try again.');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <h2 className="topbar__title">{title}</h2>
        <span className="topbar__college-tag">Sona College of Technology · IT Dept</span>
      </div>

      <div className="topbar__right">
        {/* Interactive Notification Bell */}
        <div className="topbar__notification-wrapper" ref={dropdownRef}>
          <button
            className={`topbar__icon-btn ${
              showNotifications ? 'topbar__icon-btn--active' : ''
            }`}
            aria-label="Notifications"
            onClick={() => setShowNotifications((prev) => !prev)}
            title="Notification Center"
          >
            <Icon name="notification" size={20} />
          </button>

          {/* Notification Center Popover */}
          {showNotifications && (
            <div className="topbar__dropdown" role="menu">
              <div className="topbar__dropdown-header">
                <div className="topbar__dropdown-title">
                  <Icon name="notification" size={16} />
                  <span>Notifications</span>
                </div>
              </div>

              <div className="topbar__dropdown-body">
                {/* System Notifications */}
                <div className="topbar__notif-section">
                  <div className="topbar__notif-section-title">SYSTEM ALERTS</div>
                  <div className="topbar__system-item">
                    <div className="topbar__system-dot" />
                    <div className="topbar__system-content">
                      <div className="topbar__system-title">Academic Year Active</div>
                      <div className="topbar__system-desc">Term 2026–2027 is the active academic calendar.</div>
                    </div>
                  </div>
                  <div className="topbar__system-item">
                    <div className="topbar__system-dot topbar__system-dot--green" />
                    <div className="topbar__system-content">
                      <div className="topbar__system-title">Department Management Active</div>
                      <div className="topbar__system-desc">Head of Department oversight portal operational.</div>
                    </div>
                  </div>
                  <div className="topbar__system-item">
                    <div className="topbar__system-dot topbar__system-dot--green" />
                    <div className="topbar__system-content">
                      <div className="topbar__system-title">Real-Time Attendance Engine Ready</div>
                      <div className="topbar__system-desc">BLE beacon and session tracking operational.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="topbar__dropdown-footer">
                <button
                  type="button"
                  className="topbar__dropdown-link"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/staff');
                  }}
                >
                  View Staff Directory →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="topbar__divider" />

        {/* Profile Card */}
        <div className="topbar__profile" title={`Signed in as ${user?.name} (${user?.collegeEmail})`}>
          <div className="topbar__avatar">
            <Icon name="user" size={18} />
          </div>
          <div className="topbar__profile-info">
            <span className="topbar__profile-name">{user?.name || 'Administrator'}</span>
            <span className="topbar__profile-role">
              {user?.roles?.includes('HOD') ? 'Head of Department' : user?.roles?.[0] || 'Faculty'}
            </span>
          </div>
        </div>

        <button
          className="topbar__icon-btn topbar__logout"
          aria-label="Logout"
          onClick={handleLogout}
          title="Sign Out"
        >
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  );
}
