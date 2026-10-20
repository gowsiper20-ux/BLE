import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';
import './Sidebar.css';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  allowedRoles?: UserRole[];
  children?: { label: string; path: string; allowedRoles?: UserRole[] }[];
}

const navigation: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  {
    label: 'Academic',
    path: '/academic',
    icon: 'academic',
    allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'STAFF', 'FACULTY'],
    children: [
      { label: 'Academic Years', path: '/academic-years' },
      { label: 'Batches', path: '/batches' },
      { label: 'Regulations', path: '/regulations' },
      { label: 'Classes', path: '/classes' },
    ],
  },
  { label: 'Students', path: '/students', icon: 'students', allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF', 'FACULTY'] },
  { label: 'Staff', path: '/staff', icon: 'staff', allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'FACULTY'] },
  { label: 'Subjects', path: '/subjects', icon: 'subjects', allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'STAFF', 'FACULTY'] },
  {
    label: 'Timetable',
    path: '/timetable',
    icon: 'timetable',
    allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'STAFF', 'FACULTY'],
    children: [
      { label: 'Weekly Timetable', path: '/timetable' },
      { label: 'Overrides', path: '/timetable/overrides' },
    ],
  },
  { label: 'Attendance', path: '/attendance', icon: 'attendance', allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF', 'FACULTY'] },
  { label: 'Audit Logs', path: '/audit-logs', icon: 'audit', allowedRoles: ['ADMIN', 'HOD', 'DEPUTY_HOD'] },
  { label: 'Settings', path: '/settings', icon: 'settings', allowedRoles: ['ADMIN'] },
];

export default function Sidebar() {
  const location = useLocation();
  const { hasAnyRole } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActiveParent = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return location.pathname === item.path;
  };

  const visibleNavigation = navigation.filter((item) => {
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return hasAnyRole(item.allowedRoles);
  });

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar__brand">
        <img src="/assets/dashboard-logo.png" alt="SONA College" className="sidebar__logo-img" />
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar__list">
          {visibleNavigation.map((item) => (
            <li key={item.label} className="sidebar__item">
              {item.children ? (
                <>
                  <button
                    className={`sidebar__link ${isActiveParent(item) ? 'sidebar__link--active' : ''}`}
                    onClick={() => toggleExpand(item.label)}
                    aria-expanded={expanded[item.label] || isActiveParent(item)}
                  >
                    <Icon name={item.icon} size={18} className="sidebar__link-icon" />
                    <span className="sidebar__link-label">{item.label}</span>
                    <Icon
                      name="chevron-down"
                      size={16}
                      className={`sidebar__chevron ${
                        expanded[item.label] || isActiveParent(item) ? 'sidebar__chevron--open' : ''
                      }`}
                    />
                  </button>
                  {(expanded[item.label] || isActiveParent(item)) && (
                    <ul className="sidebar__sublist">
                      {item.children
                        .filter((child) => !child.allowedRoles || hasAnyRole(child.allowedRoles))
                        .map((child) => (
                          <li key={child.path}>
                            <NavLink
                              to={child.path}
                              className={({ isActive }) =>
                                `sidebar__sublink ${isActive ? 'sidebar__sublink--active' : ''}`
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                  }
                >
                  <Icon name={item.icon} size={18} className="sidebar__link-icon" />
                  <span className="sidebar__link-label">{item.label}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__version">v0.1.0</div>
      </div>
    </aside>
  );
}
