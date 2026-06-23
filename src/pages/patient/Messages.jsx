import { useState, useEffect, useRef } from 'react';
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

export default function Messages() {
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
    c.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="chat-container card">
      {/* Conversations list */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <input
            className="form-control chat-search"
            placeholder="Search conversations..."
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
                <div className="conversation-name">{c.role === 'doctor' ? `Dr. ${c.name}` : c.name}</div>
                <div className="conversation-spec">{c.role === 'doctor' ? (c.specialization || 'General Practice') : ''}</div>
                <div className="conversation-preview">
                  {c.last_message ? (c.last_message.length > 50 ? c.last_message.slice(0, 50) + '...' : c.last_message) : 'No messages yet'}
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
                <div className="chat-header-name">{activeUser.role === 'doctor' ? `Dr. ${activeUser.name}` : activeUser.name}</div>
                <div className="chat-header-meta">
                  {activeUser.role === 'doctor' ? (activeUser.specialization || 'General Practice') : 'Patient'}
                  {' '}<span className="online-dot">● Online</span>
                </div>
              </div>
              {activeUser.is_emergency && <span className="emergency-badge pulse">🚨 Emergency</span>}
            </div>

            <div className="chat-messages">
              {!messages.length && (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Start a conversation with {activeUser.role === 'doctor' ? `Dr. ${activeUser.name}` : activeUser.name}</p>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`message-bubble ${String(m.senderId) === String(user.id) ? 'sent' : 'received'}${m.isEmergency ? ' emergency' : ''}`}>
                  {m.isEmergency && <div className="emergency-tag">🚨 EMERGENCY</div>}
                  {m.content}
                  <div className="message-time">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={send} className="chat-input-area">
              <button type="button" className={`emergency-toggle ${isEmergency ? 'active' : ''}`}
                onClick={() => setIsEmergency(!isEmergency)} title="Mark as emergency">
                🚨
              </button>
              <input className="form-control chat-text-input" placeholder="Type a message..."
                value={newMsg} onChange={e => setNewMsg(e.target.value)} />
              <button type="submit" className="chat-send-btn" disabled={!newMsg.trim()}>➤</button>
            </form>
            <div className="chat-footer-note">🔒 End-to-end encrypted · GDPR compliant</div>
          </>
        ) : (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
