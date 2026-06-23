import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_healthalertsService } from '../../generated/services/Hs_healthalertsService';
import { Hs_healthalertshs_priority, Hs_healthalertshs_alerttype } from '../../generated/models/Hs_healthalertsModel';
import { Hs_notificationsService } from '../../generated/services/Hs_notificationsService';
import { Hs_usersService } from '../../generated/services/Hs_usersService';

function toAlert(r, patientNameById) {
  return {
    id: r.hs_healthalertid,
    patient_name: patientNameById[r._hs_patient_value] || r.hs_patientname,
    priority: Hs_healthalertshs_priority[r.hs_priority] || 'low',
    alert_type: Hs_healthalertshs_alerttype[r.hs_alerttype],
    message: r.hs_message,
    is_resolved: !!r.hs_isresolved,
    created_at: r.createdon,
  };
}

function toNotification(r) {
  return { id: r.hs_notificationid, title: r.hs_title, message: r.hs_message, isRead: !!r.hs_isread, createdAt: r.createdon };
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB');
}

export default function DoctorAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      Hs_healthalertsService.getAll({ filter: `_hs_doctor_value eq ${user.id}`, orderBy: ['createdon desc'] }).then(async (r) => {
        const rows = r.data || [];
        const patientIds = [...new Set(rows.map(x => x._hs_patient_value).filter(Boolean))];
        let patientNameById = {};
        if (patientIds.length) {
          const usersResult = await Hs_usersService.getAll({ filter: patientIds.map(id => `hs_userid eq ${id}`).join(' or ') });
          patientNameById = Object.fromEntries((usersResult.data || []).map(u => [u.hs_userid, u.hs_fullname]));
        }
        setAlerts(rows.map(x => toAlert(x, patientNameById)));
      }),
      Hs_notificationsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['createdon desc'], top: 50 }).then(r => setNotifications((r.data || []).map(toNotification))),
    ]).finally(() => setLoading(false));
  }, []);

  const priorityColors = { low: 'info', medium: 'warning', high: 'danger', critical: 'danger' };
  const priorityIcons = { low: 'ℹ️', medium: '⚠️', high: '🚨', critical: '🆘' };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>Health Alerts & Tasks</h3>
          <span className="badge badge-danger">{alerts.filter(a => !a.is_resolved).length} active</span>
        </div>
        {alerts.length ? alerts.map(a => (
          <div key={a.id} style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            borderLeft: `4px solid ${a.priority === 'critical' || a.priority === 'high' ? 'var(--danger)' : a.priority === 'medium' ? 'var(--warning)' : 'var(--info)'}`,
            background: a.is_resolved ? '#f9fafb' : 'white',
            opacity: a.is_resolved ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{priorityIcons[a.priority]}</span>
                  <span style={{ fontWeight: 700 }}>{a.patient_name}</span>
                  <span className={`badge badge-${priorityColors[a.priority]}`}>{a.priority}</span>
                  {a.is_resolved && <span className="badge badge-success">Resolved</span>}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(a.created_at).toLocaleString('en-GB')}
                </div>
              </div>
              {a.alert_type && <span className="badge badge-gray">{a.alert_type}</span>}
            </div>
          </div>
        )) : (
          <div className="empty-state"><div className="empty-icon">✅</div><p>No active alerts</p></div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>Notifications</h3>
        </div>
        {notifications.length ? notifications.map(n => (
          <div key={n.id} className={`notif-item${!n.isRead ? ' unread' : ''}`}>
            <div className="notif-icon">🔔</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
            </div>
          </div>
        )) : (
          <div className="empty-state"><div className="empty-icon">🔔</div><p>No notifications</p></div>
        )}
      </div>
    </div>
  );
}
