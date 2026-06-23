import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Hs_notificationsService } from '../../generated/services/Hs_notificationsService';
import { Hs_notificationshs_type } from '../../generated/models/Hs_notificationsModel';

function toNotification(r) {
  return {
    id: r.hs_notificationid,
    title: r.hs_title,
    message: r.hs_message,
    type: Hs_notificationshs_type[r.hs_type],
    isRead: !!r.hs_isread,
    createdAt: r.createdon,
  };
}

const typeMeta = {
  appointment: { icon: '📅', color: '#1565C0' },
  medication: { icon: '💊', color: '#D97706' },
  lab_result: { icon: '🧪', color: '#0891B2' },
  system: { icon: 'ℹ️', color: '#5E7A99' },
  alert: { icon: '⚠️', color: '#DC2626' },
  message: { icon: '💬', color: '#16A34A' },
};

function dateLabel(dateStr) {
  const d = new Date(dateStr);
  const day = d.toDateString();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB');
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => Hs_notificationsService.getAll({ filter: `_hs_user_value eq ${user.id}`, orderBy: ['createdon desc'], top: 50 })
    .then(r => setNotifications((r.data || []).map(toNotification)))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await Hs_notificationsService.update(id, { hs_isread: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAll = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    await Promise.all(unreadIds.map(id => Hs_notificationsService.update(id, { hs_isread: true })));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  let lastDate = '';

  return (
    <div>
      <div className="flex-between mb-4">
        <div className="card-title"><span style={{ marginRight: 6 }}>🔔</span>All Notifications {unread > 0 && <span className="badge" style={{ background: 'var(--danger)', color: 'white', marginLeft: 8 }}>{unread} unread</span>}</div>
        {unread > 0 && <button className="btn btn-outline btn-sm" onClick={markAll}>Mark all read</button>}
      </div>

      <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
        {notifications.length ? notifications.map(n => {
          const showDateHeader = dateLabel(n.createdAt) !== lastDate;
          if (showDateHeader) lastDate = dateLabel(n.createdAt);
          const meta = typeMeta[n.type] || { icon: '🔔', color: '#5E7A99' };
          return (
            <div key={n.id}>
              {showDateHeader && (
                <div className="notif-date-header">{dateLabel(n.createdAt)}</div>
              )}
              <div className={`notif-item${!n.isRead ? ' unread' : ''}`}
                onClick={() => !n.isRead && markRead(n.id)}>
                <div className="notif-icon" style={{ background: meta.color + '22', color: meta.color }}>{meta.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 13.5, color: 'var(--primary)' }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{n.message}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</span>
                  {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-light)' }} />}
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>🔔</div>
            <p style={{ marginTop: 12 }}>No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
