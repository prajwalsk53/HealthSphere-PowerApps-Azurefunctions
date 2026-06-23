import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const patientNav = [
  { to: '/patient/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/patient/appointments', icon: '📅', label: 'Appointments' },
  { to: '/patient/calendar', icon: '🗓️', label: 'Calendar' },
  { to: '/patient/medical-records', icon: '📋', label: 'Medical Records' },
  { to: '/patient/prescriptions', icon: '💊', label: 'Prescriptions' },
  { to: '/patient/diet', icon: '🥗', label: 'Diet Tracker' },
  { to: '/patient/safe-appetite', icon: '🔍', label: 'Safe Appetite' },
  { to: '/patient/wearable', icon: '⌚', label: 'Wearable Sync' },
  { to: '/patient/health-insights', icon: '📈', label: 'Health Insights' },
  { to: '/patient/health-analysis', icon: '📊', label: 'Health Analysis' },
  { to: '/patient/documents', icon: '📁', label: 'Documents' },
  { to: '/patient/messages', icon: '💬', label: 'Messages' },
  { to: '/patient/ai-assistant', icon: '🤖', label: 'AI Assistant' },
  { to: '/patient/map', icon: '🗺️', label: 'Find Clinic' },
  { to: '/patient/questionnaire?review=1', icon: '📝', label: 'Health Questionnaire' },
  { to: '/patient/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/patient/profile', icon: '👤', label: 'Profile' },
];

const doctorNav = [
  { to: '/doctor/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/doctor/patients', icon: '👥', label: 'Patients' },
  { to: '/doctor/appointments', icon: '📅', label: 'Appointments' },
  { to: '/doctor/schedule', icon: '🗓️', label: 'Schedule' },
  { to: '/doctor/lab-results', icon: '🧪', label: 'Lab Results' },
  { to: '/doctor/prescriptions', icon: '💊', label: 'Prescriptions' },
  { to: '/doctor/prescription-orders', icon: '📋', label: 'Prescription Orders' },
  { to: '/doctor/alerts', icon: '⚠️', label: 'Alerts' },
  { to: '/doctor/messages', icon: '💬', label: 'Messages' },
  { to: '/doctor/profile', icon: '👤', label: 'Profile' },
];

const adminNav = [
  { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/admin/users', icon: '👥', label: 'Users' },
  { to: '/admin/doctors', icon: '🩺', label: 'Doctors' },
  { to: '/admin/approvals', icon: '✅', label: 'Approvals' },
  { to: '/admin/analytics', icon: '📈', label: 'Analytics' },
  { to: '/admin/access-logs', icon: '🔒', label: 'Access Logs' },
  { to: '/admin/food-database', icon: '🍎', label: 'Food Database' },
  { to: '/admin/diseases', icon: '🧬', label: 'Diseases' },
  { to: '/admin/settings', icon: '⚙️', label: 'Settings' },
  { to: '/admin/test-email', icon: '📨', label: 'Email Testing' },
];

const govNav = [
  { to: '/government/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/government/analytics', icon: '📈', label: 'Analytics' },
  { to: '/government/alerts', icon: '⚠️', label: 'Health Alerts' },
  { to: '/government/map',      icon: '🗺️', label: 'Regional Map' },
  { to: '/government/regional', icon: '📋', label: 'Regional Analysis' },
  { to: '/government/reports',  icon: '📄', label: 'Reports' },
  { to: '/government/trends',   icon: '📉', label: 'Trend Analysis' },
];

const medicalTeamNav = [
  { to: '/medical-team/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/medical-team/medicine-queue', icon: '💊', label: 'Medicine Queue' },
  { to: '/medical-team/profile', icon: '👤', label: 'My Profile' },
];

const navMap = { patient: patientNav, doctor: doctorNav, admin: adminNav, government: govNav, pharmacy: medicalTeamNav };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = navMap[user?.role] || [];
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">❤️</div>
        <div>
          <div className="logo-text">HealthSphere</div>
          <div className="logo-sub">HEALTHCARE</div>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">
          {user?.profile_image
            ? <img src={`http://localhost:5002/uploads/${user.profile_image}`} alt={user.name} />
            : initials}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name}</div>
          <div className="user-role">{user?.role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={handleLogout} className="nav-item" style={{ color: '#f87171' }}>
          <span className="nav-icon">🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
