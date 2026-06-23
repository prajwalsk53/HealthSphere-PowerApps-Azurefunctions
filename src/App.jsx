import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import './assets/style.css';

// Auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import DevSeed from './pages/DevSeed';

// Patient pages
import PatientDashboard from './pages/patient/Dashboard';
import PatientAppointments from './pages/patient/Appointments';
import PatientCalendar from './pages/patient/Calendar';
import MedicalRecords from './pages/patient/MedicalRecords';
import Prescriptions from './pages/patient/Prescriptions';
import DietTracker from './pages/patient/DietTracker';
import SafeAppetite from './pages/patient/SafeAppetite';
import HealthInsights from './pages/patient/HealthInsights';
import HealthAnalysis from './pages/patient/HealthAnalysis';
import PatientDocuments from './pages/patient/Documents';
import PatientMessages from './pages/patient/Messages';
import AIAssistant from './pages/patient/AIAssistant';
import PatientMap from './pages/patient/Map';
import PatientNotifications from './pages/patient/Notifications';
import PatientProfile from './pages/patient/Profile';
import PatientQuestionnaire from './pages/patient/Questionnaire';
import PatientWearable from './pages/patient/Wearable';

// Doctor pages
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorPatients from './pages/doctor/Patients';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorSchedule from './pages/doctor/Schedule';
import LabResults from './pages/doctor/LabResults';
import DoctorPrescriptions from './pages/doctor/Prescriptions';
import DoctorPrescriptionOrders from './pages/doctor/PrescriptionOrders';
import DoctorAlerts from './pages/doctor/Alerts';
import DoctorMessages from './pages/doctor/Messages';
import DoctorProfile from './pages/doctor/Profile';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminDoctors from './pages/admin/Doctors';
import Approvals from './pages/admin/Approvals';
import AdminAnalytics from './pages/admin/Analytics';
import AccessLogs from './pages/admin/AccessLogs';
import FoodDatabase from './pages/admin/FoodDatabase';
import Diseases from './pages/admin/Diseases';
import AdminSettings from './pages/admin/Settings';
import TestEmail from './pages/admin/TestEmail';

// Government pages
import GovDashboard from './pages/government/Dashboard';
import GovAnalytics from './pages/government/Analytics';
import GovAlerts from './pages/government/Alerts';
import GovMap from './pages/government/Map';
import GovRegional from './pages/government/Regional';
import GovReports  from './pages/government/Reports';
import GovTrends   from './pages/government/Trends';

// Medical Team pages
import MedicalTeamDashboard from './pages/medical-team/Dashboard';
import MedicineQueue from './pages/medical-team/MedicineQueue';
import MedicalTeamProfile from './pages/medical-team/Profile';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const routes = { patient: '/patient/dashboard', doctor: '/doctor/dashboard', admin: '/admin/dashboard', government: '/government/dashboard', pharmacy: '/medical-team/dashboard' };
    return <Navigate to={routes[user.role] || '/login'} replace />;
  }
  return <Layout>{children}</Layout>;
}

function StandaloneRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const routes = { patient: '/patient/dashboard', doctor: '/doctor/dashboard', admin: '/admin/dashboard', government: '/government/dashboard', pharmacy: '/medical-team/dashboard' };
    return <Navigate to={routes[user.role] || '/login'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${user.role}/dashboard`} replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dev-seed" element={<DevSeed />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Patient */}
      <Route path="/patient/dashboard" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
      <Route path="/patient/appointments" element={<ProtectedRoute roles={['patient']}><PatientAppointments /></ProtectedRoute>} />
      <Route path="/patient/calendar" element={<ProtectedRoute roles={['patient']}><PatientCalendar /></ProtectedRoute>} />
      <Route path="/patient/medical-records" element={<ProtectedRoute roles={['patient']}><MedicalRecords /></ProtectedRoute>} />
      <Route path="/patient/prescriptions" element={<ProtectedRoute roles={['patient']}><Prescriptions /></ProtectedRoute>} />
      <Route path="/patient/diet" element={<ProtectedRoute roles={['patient']}><DietTracker /></ProtectedRoute>} />
      <Route path="/patient/safe-appetite" element={<ProtectedRoute roles={['patient']}><SafeAppetite /></ProtectedRoute>} />
      <Route path="/patient/wearable" element={<ProtectedRoute roles={['patient']}><PatientWearable /></ProtectedRoute>} />
      <Route path="/patient/health-insights" element={<ProtectedRoute roles={['patient']}><HealthInsights /></ProtectedRoute>} />
      <Route path="/patient/health-analysis" element={<ProtectedRoute roles={['patient']}><HealthAnalysis /></ProtectedRoute>} />
      <Route path="/patient/documents" element={<ProtectedRoute roles={['patient']}><PatientDocuments /></ProtectedRoute>} />
      <Route path="/patient/messages" element={<ProtectedRoute roles={['patient']}><PatientMessages /></ProtectedRoute>} />
      <Route path="/patient/ai-assistant" element={<ProtectedRoute roles={['patient']}><AIAssistant /></ProtectedRoute>} />
      <Route path="/patient/map" element={<ProtectedRoute roles={['patient']}><PatientMap /></ProtectedRoute>} />
      <Route path="/patient/notifications" element={<ProtectedRoute roles={['patient']}><PatientNotifications /></ProtectedRoute>} />
      <Route path="/patient/profile" element={<ProtectedRoute roles={['patient']}><PatientProfile /></ProtectedRoute>} />
      <Route path="/patient/questionnaire" element={<StandaloneRoute roles={['patient']}><PatientQuestionnaire /></StandaloneRoute>} />

      {/* Doctor */}
      <Route path="/doctor/dashboard" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
      <Route path="/doctor/patients" element={<ProtectedRoute roles={['doctor']}><DoctorPatients /></ProtectedRoute>} />
      <Route path="/doctor/appointments" element={<ProtectedRoute roles={['doctor']}><DoctorAppointments /></ProtectedRoute>} />
      <Route path="/doctor/schedule" element={<ProtectedRoute roles={['doctor']}><DoctorSchedule /></ProtectedRoute>} />
      <Route path="/doctor/lab-results" element={<ProtectedRoute roles={['doctor']}><LabResults /></ProtectedRoute>} />
      <Route path="/doctor/prescriptions" element={<ProtectedRoute roles={['doctor']}><DoctorPrescriptions /></ProtectedRoute>} />
      <Route path="/doctor/prescription-orders" element={<ProtectedRoute roles={['doctor']}><DoctorPrescriptionOrders /></ProtectedRoute>} />
      <Route path="/doctor/alerts" element={<ProtectedRoute roles={['doctor']}><DoctorAlerts /></ProtectedRoute>} />
      <Route path="/doctor/messages" element={<ProtectedRoute roles={['doctor']}><DoctorMessages /></ProtectedRoute>} />
      <Route path="/doctor/profile" element={<ProtectedRoute roles={['doctor']}><DoctorProfile /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/doctors" element={<ProtectedRoute roles={['admin']}><AdminDoctors /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute roles={['admin']}><Approvals /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
      <Route path="/admin/access-logs" element={<ProtectedRoute roles={['admin']}><AccessLogs /></ProtectedRoute>} />
      <Route path="/admin/food-database" element={<ProtectedRoute roles={['admin']}><FoodDatabase /></ProtectedRoute>} />
      <Route path="/admin/diseases" element={<ProtectedRoute roles={['admin']}><Diseases /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/test-email" element={<ProtectedRoute roles={['admin']}><TestEmail /></ProtectedRoute>} />

      {/* Government */}
      <Route path="/government/dashboard" element={<ProtectedRoute roles={['government']}><GovDashboard /></ProtectedRoute>} />
      <Route path="/government/analytics" element={<ProtectedRoute roles={['government']}><GovAnalytics /></ProtectedRoute>} />
      <Route path="/government/alerts" element={<ProtectedRoute roles={['government']}><GovAlerts /></ProtectedRoute>} />
      <Route path="/government/map" element={<ProtectedRoute roles={['government']}><GovMap /></ProtectedRoute>} />
      <Route path="/government/regional" element={<ProtectedRoute roles={['government']}><GovRegional /></ProtectedRoute>} />
      <Route path="/government/reports"  element={<ProtectedRoute roles={['government']}><GovReports  /></ProtectedRoute>} />
      <Route path="/government/trends"  element={<ProtectedRoute roles={['government']}><GovTrends   /></ProtectedRoute>} />

      {/* Medical Team */}
      <Route path="/medical-team/dashboard" element={<ProtectedRoute roles={['pharmacy']}><MedicalTeamDashboard /></ProtectedRoute>} />
      <Route path="/medical-team/medicine-queue" element={<ProtectedRoute roles={['pharmacy']}><MedicineQueue /></ProtectedRoute>} />
      <Route path="/medical-team/profile" element={<ProtectedRoute roles={['pharmacy']}><MedicalTeamProfile /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
