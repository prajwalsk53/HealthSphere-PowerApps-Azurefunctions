import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

function toProfile(u) {
  return { name: u.hs_fullname, phone: u.hs_phonenumber, email: u.hs_emailaddress, nhsId: u.hs_nhsidentifier };
}

export default function MedicalTeamProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Hs_usersService.get(user.id).then(r => {
      const p = toProfile(r.data);
      setProfile(p);
      setForm({ name: p.name || '', phone: p.phone || '' });
    }).finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Hs_usersService.update(user.id, { hs_fullname: form.name, hs_phonenumber: form.phone });
      setProfile(p => ({ ...p, ...form }));
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMsg({ type: 'danger', text: err.message || 'Failed to update' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 680 }}>
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="user-avatar" style={{ width: 72, height: 72, fontSize: 26 }}>
            {profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{profile?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--primary-light)', fontWeight: 600, marginTop: 2 }}>
              <i className="fas fa-pills" /> Medical Team — Pharmacy
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              <i className="fas fa-id-badge" /> NHS ID: {profile?.nhsId || '—'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge badge-success"><i className="fas fa-check-circle" /> Active</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3><i className="fas fa-edit" /> Edit Details</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" value={profile?.email || ''} disabled style={{ opacity: .6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-control" placeholder="07700000000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
