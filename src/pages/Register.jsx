import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import { Hs_usersService } from '../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_accountstatus, Hs_usershs_gender } from '../generated/models/Hs_usersModel';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([code, label]) => [label, Number(code)]));
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_usershs_accountstatus).map(([code, label]) => [label, Number(code)]));
const GENDER_CODES = Object.fromEntries(Object.entries(Hs_usershs_gender).map(([code, label]) => [label, Number(code)]));

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'patient', phone: '', date_of_birth: '', gender: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    setError(null);
    try {
      const escapedEmail = form.email.replace(/'/g, "''");
      const existing = await Hs_usersService.getAll({ filter: `hs_emailaddress eq '${escapedEmail}'` });
      if (existing.data?.length) throw new Error('Email already registered');

      const nhsId = 'NHS' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const result = await Hs_usersService.create({
        hs_fullname: form.name,
        hs_emailaddress: form.email,
        hs_passwordhash: bcrypt.hashSync(form.password, 12),
        hs_userrole: ROLE_CODES[form.role],
        hs_phonenumber: form.phone || undefined,
        hs_dateofbirth: form.date_of_birth || undefined,
        hs_gender: form.gender ? GENDER_CODES[form.gender] : undefined,
        hs_nhsidentifier: nhsId,
        hs_accountstatus: form.role === 'doctor' ? STATUS_CODES.pending : STATUS_CODES.active,
      });

      const newUser = {
        id: result.data.hs_userid,
        name: form.name,
        email: form.email,
        role: form.role,
        nhsId,
      };
      localStorage.setItem('user', JSON.stringify(newUser));
      const routes = { patient: '/patient/dashboard', doctor: '/doctor/dashboard' };
      navigate(routes[newUser.role] || '/login');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="logo-icon">❤️</div>
          <h1>Create Account</h1>
          <p>Join HealthSphere today</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={submit}>
          <div className="grid grid-2 gap-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Full Name *</label>
              <input className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" className="form-control" required minLength={8} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input type="password" className="form-control" required value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Account Type</label>
              <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor (requires approval)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-control" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-control" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
