import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const pageTitles = {
  '/patient/dashboard': ['Dashboard', 'Welcome back'],
  '/patient/appointments': ['Appointments', 'Manage your appointments'],
  '/patient/calendar': ['Appointment Calendar', 'View and manage your schedule'],
  '/patient/medical-records': ['Medical Records', 'View your health history'],
  '/patient/diet': ['Diet Tracker', 'Track your nutrition'],
  '/patient/safe-appetite': ['Safe Appetite', 'Scan for allergens'],
  '/patient/health-insights': ['Health Insights', 'Your health trends'],
  '/patient/health-analysis': ['Overall Health Analysis', 'Personalised health evaluation across 7 dimensions'],
  '/patient/documents': ['Documents', 'Your medical files'],
  '/patient/messages': ['Messages', 'Chat with your doctor'],
  '/patient/ai-assistant': ['AI Assistant', 'Get health guidance'],
  '/patient/map': ['Find a Clinic', 'NHS hospitals & clinics'],
  '/patient/notifications': ['Notifications', 'Your alerts'],
  '/patient/profile': ['Profile', 'Your personal information'],
  '/patient/prescriptions': ['Prescriptions', 'Your medications'],
  '/patient/wearable': ['Wearable & Device Sync', 'Google Fit — real-time health data import'],
  '/doctor/dashboard': ['Dashboard', 'Doctor overview'],
  '/doctor/patients': ['Patients', 'Your patient roster'],
  '/doctor/appointments': ['Appointments', 'Manage appointments'],
  '/doctor/schedule': ['Schedule', 'Your availability'],
  '/doctor/lab-results': ['Lab Results', 'Patient test results'],
  '/doctor/prescriptions': ['Prescriptions', 'Issue prescriptions'],
  '/doctor/prescription-orders': ['Prescription Orders', 'Review and process patient prescription requests'],
  '/doctor/alerts': ['Alerts & Tasks', 'Health alerts'],
  '/doctor/messages': ['Messages', 'Patient communications'],
  '/doctor/profile': ['Profile', 'Doctor information'],
  '/admin/dashboard': ['Admin Dashboard', 'System overview'],
  '/admin/users': ['Users', 'Manage all users'],
  '/admin/doctors': ['Doctors', 'Manage doctors'],
  '/admin/approvals': ['Approvals', 'Pending registrations'],
  '/admin/analytics': ['Analytics', 'Platform insights'],
  '/admin/access-logs': ['Access Logs', 'Privacy audit trail'],
  '/admin/food-database': ['Food Database', 'Nutrition data'],
  '/admin/diseases': ['Disease Registry', 'Genetic conditions'],
  '/admin/settings': ['Settings', 'System configuration'],
  '/admin/test-email': ['Email Testing', 'Test automated email templates'],
  '/government/dashboard': ['Gov Dashboard', 'Population health'],
  '/government/analytics': ['Analytics', 'Population insights'],
  '/government/alerts': ['Health Alerts', 'National alerts'],
  '/government/map': ['Regional Map', 'Health by region'],
  '/government/regional': ['Regional Analysis', 'UK regional health breakdown'],
  '/government/reports':  ['Policy Reports', 'DHSC publications & policy briefs'],
  '/government/trends':   ['Trend Analysis', 'Population health trends · England & Wales · 2025'],
  '/medical-team/dashboard': ['Medical Team Dashboard', 'Medicine dispensing & order management'],
  '/medical-team/medicine-queue': ['Medicine Queue', 'Process and dispatch approved prescription orders'],
  '/medical-team/profile': ['My Profile', 'Medical Team — Pharmacy Staff'],
};

export default function Layout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [title, subtitle] = pageTitles[location.pathname] || ['HealthSphere', ''];

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{title}</h2>
            <p>{subtitle || today}</p>
          </div>
          <div className="topbar-right">
            <a href={`/${user?.role}/messages`} className="topbar-btn" title="Messages">💬</a>
            <a href={`/${user?.role}/notifications`} className="topbar-btn" title="Notifications">🔔</a>
            <div className="user-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
