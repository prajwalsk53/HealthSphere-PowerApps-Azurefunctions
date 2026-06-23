import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loadConversations, loadMessages, sendChatMessage } from '../../lib/messaging';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function DoctorMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  const refreshConversations = () => loadConversations(user.id).then(setConversations);

  useEffect(() => {
    refreshConversations();
    const t = setInterval(refreshConversations, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    const refresh = () => loadMessages(user.id, activeUser.id).then(setMessages);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [activeUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeUser) return;
    const msg = await sendChatMessage(user.id, activeUser.id, newMsg, isEmergency);
    setMessages(prev => [...prev, msg]);
    setNewMsg('');
    setIsEmergency(false);
    refreshConversations();
  };

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const filteredConversations = conversations.filter(c =>
    !search.trim() || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.nhsId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="chat-container card">
      {/* Conversations list */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <input
            className="form-control chat-search"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="chat-conv-list">
          {filteredConversations.map(c => (
            <div key={c.id} className={`conversation-item${activeUser?.id === c.id ? ' active' : ''}`}
              onClick={() => setActiveUser(c)}>
              <div className="user-avatar chat-avatar">{initials(c.name)}</div>
              <div className="conversation-info">
                <div className="conversation-name">{c.name}</div>
                {c.is_emergency && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
                    <i className="fas fa-exclamation-triangle" /> Emergency
                  </div>
                )}
                <div className="conversation-preview">
                  {c.last_message ? (c.last_message.length > 45 ? c.last_message.slice(0, 45) + '...' : c.last_message) : 'No messages yet'}
                </div>
              </div>
              <div className="conversation-meta">
                {c.last_message_time && <span className="conversation-time">{timeAgo(c.last_message_time)}</span>}
                {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
              </div>
            </div>
          ))}
          {!filteredConversations.length && (
            <div className="empty-state"><div className="empty-icon">💬</div><p>No conversations yet</p></div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-main">
        {activeUser ? (
          <>
            <div className="chat-header">
              <div className="user-avatar chat-avatar">{initials(activeUser.name)}</div>
              <div className="chat-header-info">
                <div className="chat-header-name">{activeUser.name}</div>
                <div className="chat-header-meta">Patient · NHS: {activeUser.nhsId || '—'}</div>
              </div>
              <Link to="/doctor/patients" className="btn btn-sm btn-primary"><i className="fas fa-folder-open" /> Open Record</Link>
            </div>

            <div className="chat-messages">
              {!messages.length && (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Start conversation with {activeUser.name}</p>
                </div>
              )}
              {messages.map(m => {
                const isSent = String(m.senderId) === String(user.id);
                return (
                  <div key={m.id} className={`message-bubble ${isSent ? 'sent' : 'received'}${m.isEmergency ? ' emergency' : ''}`}>
                    {!isSent && <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{m.sender_name}</div>}
                    {m.isEmergency && <div className="emergency-tag">🚨 EMERGENCY</div>}
                    {m.content}
                    <div className="message-time">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={send} className="chat-input-area">
              <button type="button" className={`emergency-toggle ${isEmergency ? 'active' : ''}`}
                onClick={() => setIsEmergency(!isEmergency)} title="Mark as emergency">
                🚨
              </button>
              <input className="form-control chat-text-input" placeholder="Type your response..."
                value={newMsg} onChange={e => setNewMsg(e.target.value)}
                autoComplete="off" />
              <button type="submit" className="chat-send-btn" disabled={!newMsg.trim()}><i className="fas fa-paper-plane" /></button>
            </form>
            <div className="chat-footer-note"><i className="fas fa-lock" /> Encrypted · All messages are audit-logged</div>
          </>
        ) : (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
