import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { useAuth } from '../../context/AuthContext';
import { Hs_usersService } from '../../generated/services/Hs_usersService';
import { Hs_usershs_gender } from '../../generated/models/Hs_usersModel';
import { Hs_familyhistoriesService } from '../../generated/services/Hs_familyhistoriesService';

const GENDER_CODES = Object.fromEntries(Object.entries(Hs_usershs_gender).map(([code, label]) => [label, Number(code)]));

function toFamily(r) {
  return {
    id: r.hs_familyhistoryid,
    relation: r.hs_relation,
    condition_name: r.hs_conditionname,
    diagnosis_year: r.hs_diagnosisyear,
  };
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', date_of_birth: user?.dateOfBirth?.split('T')[0] || '',
    gender: user?.gender || '', address: user?.address || '', blood_type: user?.bloodType || '',
    allergies_summary: user?.allergiesSummary || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [fhForm, setFhForm] = useState({ relation: '', condition_name: '', diagnosis_year: '', notes: '' });

  const loadFH = () => {
    Hs_familyhistoriesService.getAll({ filter: `_hs_user_value eq ${user.id}` })
      .then(r => setFamilyHistory((r.data || []).map(toFamily)));
  };

  useEffect(() => { loadFH(); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await Hs_usersService.update(user.id, {
        hs_fullname: form.name,
        hs_phonenumber: form.phone || undefined,
        hs_dateofbirth: form.date_of_birth || undefined,
        hs_gender: form.gender ? GENDER_CODES[form.gender] : undefined,
        hs_address: form.address || undefined,
        hs_allergiessummary: form.allergies_summary || undefined,
      });
      updateUser({ ...user, name: form.name, phone: form.phone, dateOfBirth: form.date_of_birth, gender: form.gender, address: form.address, allergiesSummary: form.allergies_summary });
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMsg({ type: 'danger', text: err.message || 'Failed to update' });
    } finally { setLoading(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return setPwMsg({ type: 'danger', text: 'Passwords do not match' });
    setPwLoading(true);
    try {
      const result = await Hs_usersService.get(user.id);
      const record = result.data;
      if (!record?.hs_passwordhash || !bcrypt.compareSync(pwForm.currentPassword, record.hs_passwordhash)) {
        throw new Error('Current password is incorrect');
      }
      await Hs_usersService.update(user.id, { hs_passwordhash: bcrypt.hashSync(pwForm.newPassword, 12) });
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'danger', text: err.message || 'Failed to change password' });
    } finally { setPwLoading(false); }
  };

  const addFH = async (e) => {
    e.preventDefault();
    await Hs_familyhistoriesService.create({
      'hs_User@odata.bind': `/hs_users(${user.id})`,
      hs_relation: fhForm.relation,
      hs_conditionname: fhForm.condition_name,
      hs_diagnosisyear: fhForm.diagnosis_year ? Number(fhForm.diagnosis_year) : undefined,
      hs_notes: fhForm.notes || undefined,
    });
    loadFH();
    setFhForm({ relation: '', condition_name: '', diagnosis_year: '', notes: '' });
  };

  const deleteFH = async (id) => {
    await Hs_familyhistoriesService.delete(id);
    setFamilyHistory(prev => prev.filter(f => f.id !== id));
  };

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const memberSince = user?.createdAt;

  return (
    <div>
    <div className="profile-layout">
      {/* Profile summary card */}
      <div className="card profile-summary-card">
        <div className="card-body" style={{ textAlign: 'center' }}>
          <div className="profile-avatar">{initials(user?.name)}</div>
          <h3 style={{ margin: 0, color: 'var(--primary)' }}>{user?.name}</h3>
          <p style={{ color: 'var(--primary-light)', fontSize: 13, margin: '4px 0' }}>Patient</p>

          {user?.nhsId && (
            <div className="profile-nhs-box">
              <div className="profile-nhs-label">NHS ID</div>
              <strong>{user.nhsId}</strong>
            </div>
          )}

          <div className="profile-divider" />

          <div className="profile-contact-list">
            <div><i className="fas fa-envelope"></i> {user?.email}</div>
            <div><i className="fas fa-phone"></i> {user?.phone || '—'}</div>
            <div><i className="fas fa-tint"></i> {user?.bloodType || '—'}</div>
            <div><i className="fas fa-birthday-cake"></i> {user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
          </div>

          <div className="profile-divider" />

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Member since {memberSince ? new Date(memberSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="card">
        <div className="card-header">
          <h3>Edit Profile</h3>
        </div>
        <div className="card-body">
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="grid grid-2 gap-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-control" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-2 gap-2">
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Type</label>
                <select className="form-control" value={form.blood_type} disabled title="Blood type editing is temporarily disabled while the Dataverse choice values are fixed">
                  <option value="">{form.blood_type || 'Unknown'}</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Allergies Summary</label>
              <textarea className="form-control" rows={2} value={form.allergies_summary} onChange={e => setForm({...form, allergies_summary: e.target.value})} />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>

      <div className="grid grid-2 gap-4 mt-4">
        {/* Change Password */}
        <div className="card mb-4">
          <div className="card-header"><h3>Change Password</h3></div>
          <div className="card-body">
            {pwMsg && <div className={`alert alert-${pwMsg.type}`}>{pwMsg.text}</div>}
            <form onSubmit={changePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-control" value={pwForm.currentPassword}
                  onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={pwForm.newPassword}
                  onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-control" value={pwForm.confirm}
                  onChange={e => setPwForm({...pwForm, confirm: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={pwLoading}>
                {pwLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Family History */}
        <div className="card">
          <div className="card-header"><h3>Family Medical History</h3></div>
          <div className="card-body">
            <form onSubmit={addFH} className="grid grid-2 gap-2 mb-4">
              <div className="form-group">
                <label className="form-label">Relation</label>
                <input className="form-control" placeholder="e.g. Father" value={fhForm.relation}
                  onChange={e => setFhForm({...fhForm, relation: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <input className="form-control" placeholder="e.g. Diabetes Type 2" value={fhForm.condition_name}
                  onChange={e => setFhForm({...fhForm, condition_name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input type="number" className="form-control" placeholder="Year diagnosed" value={fhForm.diagnosis_year}
                  onChange={e => setFhForm({...fhForm, diagnosis_year: e.target.value})} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-accent w-full">+ Add</button>
              </div>
            </form>
            {familyHistory.map(f => (
              <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{f.relation}</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>•</span>
                  <span>{f.condition_name}</span>
                  {f.diagnosis_year && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>({f.diagnosis_year})</span>}
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => deleteFH(f.id)}>✕</button>
              </div>
            ))}
            {!familyHistory.length && <div className="text-muted text-center mt-4">No family history added</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
