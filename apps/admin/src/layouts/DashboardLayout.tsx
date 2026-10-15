import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './DashboardLayout.css';

export default function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <Topbar />
      <main className="dashboard-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
