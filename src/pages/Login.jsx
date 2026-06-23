import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../assets/auth.css';

const DEMO_ACCOUNTS = [
  { name: 'Emma Patel', email: 'emma.patel007@gmail.com', role: 'Patient', icon: '🧑', bg: '#DBEAFE', badge: { bg: '#DBEAFE', color: '#1E40AF' } },
  { name: 'Dr. Jessica Johns', email: 'jessica.johns@leicesterhospital.nhs.uk', role: 'Doctor', icon: '👩‍⚕️', bg: '#DCFCE7', badge: { bg: '#DCFCE7', color: '#166534' } },
  { name: 'System Admin', email: 'admin@healthsphere.info', role: 'Admin', icon: '🛡️', bg: '#FEF3C7', badge: { bg: '#FEF3C7', color: '#92400E' } },
  { name: 'W. Jayson', email: 'w.jayson@dhsc.gov.uk', role: 'Gov. Analyst', icon: '🏛️', bg: '#EDE9FE', badge: { bg: '#EDE9FE', color: '#5B21B6' } },
  { name: 'Medical Team', email: 'medteam@healthsphere.nhs.uk', role: 'Pharmacy', icon: '💊', bg: '#F0FDF4', badge: { bg: '#F0FDF4', color: '#166534' } },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      const routes = { patient: '/patient/dashboard', doctor: '/doctor/dashboard', admin: '/admin/dashboard', government: '/government/dashboard', pharmacy: '/medical-team/dashboard' };
      navigate(routes[user.role] || '/patient/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  const fillLogin = (account) => {
    setEmail(account.email);
    setPassword('password');
  };

  return (
    <div className="auth-shell-page">
      <div className="bg-dot bg-dot-1"></div>
      <div className="bg-dot bg-dot-2"></div>
      <div className="bg-dot bg-dot-3"></div>

      <div className="card-shell">
        {/* LEFT PANEL */}
        <div className="panel-left">
          <Link to="/" className="back-link"><i className="fas fa-arrow-left"></i> Back to Home</Link>

          <div className="pl-logo">
            <div className="pl-logo-mark"><i className="fas fa-heartbeat"></i></div>
            <div>
              <h2>HealthSphere</h2>
              <p>Connected Health Platform</p>
            </div>
          </div>

          <div className="pl-img-wrap">
            <div className="pl-circle">
              <img
                src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=500&h=600&q=85&auto=format&fit=crop&crop=top"
                alt="Healthcare Professional"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className="pl-tagline">
              <h3>Your Health,<br />Connected</h3>
              <p>Secure portal for patients,<br />doctors &amp; health analysts</p>
            </div>
          </div>

          <div className="pl-pills">
            <div className="pl-pill"><i className="fas fa-lock"></i> Encrypted</div>
            <div className="pl-pill"><i className="fas fa-shield-alt"></i> GDPR</div>
            <div className="pl-pill"><i className="fas fa-hospital"></i> Certified</div>
            <div className="pl-pill"><i className="fas fa-users"></i> Trusted Care</div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="panel-right">
          <div className="pr-head">
            <h3>Sign In to HealthSphere</h3>
            <p>New here? <Link to="/register">Create an account</Link></p>
          </div>

          {error && (
            <div className="fc-error">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="fgroup">
              <div className="flabel">Email Address</div>
              <div className="fwrap">
                <i className="fas fa-envelope ficon"></i>
                <input type="email" className="finput" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required />
              </div>
            </div>

            <div className="fgroup">
              <div className="flabel">
                Password
                <a href="#">Forgot password?</a>
              </div>
              <div className="fwrap">
                <i className="fas fa-lock ficon"></i>
                <input type={showPassword ? 'text' : 'password'} className="finput" placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required style={{ paddingRight: 40 }} />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(s => !s)}>
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="rem-row">
              <input type="checkbox" id="remDev" />
              <label htmlFor="remDev">Remember this device</label>
            </div>

            <button type="submit" className="sub-btn" disabled={loading}>
              <i className="fas fa-arrow-right"></i> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="reg-row">
            Don't have an account? <Link to="/register">Create Account</Link>
          </div>

          {/* Demo accounts */}
          <div className="demo-sec">
            <div className="demo-hd">Demo Accounts — click to fill (password: "password")</div>
            <div className="demo-grid">
              {DEMO_ACCOUNTS.map(a => (
                <button key={a.role} className="demo-item" type="button" onClick={() => fillLogin(a)}>
                  <div className="di-av" style={{ background: a.bg }}>{a.icon}</div>
                  <div className="di-info">
                    <div className="di-name">{a.name}</div>
                    <div className="di-role">{a.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="sec-foot">
            <i className="fas fa-lock"></i>
            End-to-end encrypted &middot; GDPR compliant
          </div>

          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Link to="/dev-seed" style={{ fontSize: 11, color: '#94A3B8' }}>Dev: Seed Demo Data</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
