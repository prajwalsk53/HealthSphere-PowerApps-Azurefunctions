import { Hs_messagesService } from '../generated/services/Hs_messagesService';
import { Hs_usersService } from '../generated/services/Hs_usersService';
import { Hs_usershs_userrole, Hs_usershs_accountstatus } from '../generated/models/Hs_usersModel';
import { Hs_doctorsService } from '../generated/services/Hs_doctorsService';

const ROLE_CODES = Object.fromEntries(Object.entries(Hs_usershs_userrole).map(([c, l]) => [l, Number(c)]));
const STATUS_CODES = Object.fromEntries(Object.entries(Hs_usershs_accountstatus).map(([c, l]) => [l, Number(c)]));

function toMessage(r) {
  return {
    id: r.hs_messageid,
    senderId: r._hs_sender_value,
    receiverId: r._hs_receiver_value,
    sender_name: r.hs_sendername,
    content: r.hs_ontent,
    isEmergency: !!r.hs_semergency,
    isRead: !!r.hs_sread,
    createdAt: r.createdon,
  };
}

export async function loadConversations(myId) {
  const res = await Hs_messagesService.getAll({
    filter: `_hs_sender_value eq ${myId} or _hs_receiver_value eq ${myId}`,
    orderBy: ['createdon desc'],
  });
  const msgs = (res.data || []).map(toMessage);
  const convMap = new Map();
  for (const m of msgs) {
    const otherId = m.senderId === myId ? m.receiverId : m.senderId;
    if (!otherId || convMap.has(otherId)) continue;
    convMap.set(otherId, { id: otherId, last_message: m.content, last_message_time: m.createdAt, is_emergency: m.isEmergency });
  }

  const otherIds = [...convMap.keys()];
  if (otherIds.length) {
    const [usersRes, doctorsRes, unreadRes] = await Promise.all([
      Hs_usersService.getAll({ filter: otherIds.map(id => `hs_userid eq ${id}`).join(' or ') }),
      Hs_doctorsService.getAll({ filter: otherIds.map(id => `_hs_user_value eq ${id}`).join(' or ') }),
      Hs_messagesService.getAll({ filter: `_hs_receiver_value eq ${myId} and hs_sread eq false` }),
    ]);
    const userById = Object.fromEntries((usersRes.data || []).map(u => [u.hs_userid, u]));
    const doctorByUserId = Object.fromEntries((doctorsRes.data || []).map(d => [d._hs_user_value, d]));
    const unreadCounts = {};
    for (const m of (unreadRes.data || [])) {
      const from = m._hs_sender_value;
      unreadCounts[from] = (unreadCounts[from] || 0) + 1;
    }
    for (const [id, conv] of convMap) {
      const u = userById[id];
      conv.name = u?.hs_fullname;
      conv.role = u ? Hs_usershs_userrole[u.hs_userrole] : undefined;
      conv.nhsId = u?.hs_nhsidentifier;
      conv.specialization = doctorByUserId[id]?.hs_specialization;
      conv.unread_count = unreadCounts[id] || 0;
    }
  }

  let conversations = [...convMap.values()];

  if (!conversations.length) {
    const meRes = await Hs_usersService.get(myId);
    if (Hs_usershs_userrole[meRes.data?.hs_userrole] === 'patient') {
      const docsRes = await Hs_usersService.getAll({
        filter: `hs_userrole eq ${ROLE_CODES.doctor} and hs_accountstatus eq ${STATUS_CODES.active}`, top: 5,
      });
      const doctorIds = (docsRes.data || []).map(d => d.hs_userid);
      const profilesRes = doctorIds.length
        ? await Hs_doctorsService.getAll({ filter: doctorIds.map(id => `_hs_user_value eq ${id}`).join(' or ') })
        : { data: [] };
      const profByUser = Object.fromEntries((profilesRes.data || []).map(d => [d._hs_user_value, d]));
      conversations = (docsRes.data || []).map(d => ({
        id: d.hs_userid, name: d.hs_fullname, role: 'doctor',
        specialization: profByUser[d.hs_userid]?.hs_specialization,
        last_message: '', last_message_time: null, is_emergency: false, unread_count: 0,
      }));
    }
  }

  return conversations;
}

export async function loadMessages(myId, otherId) {
  const res = await Hs_messagesService.getAll({
    filter: `(_hs_sender_value eq ${myId} and _hs_receiver_value eq ${otherId}) or (_hs_sender_value eq ${otherId} and _hs_receiver_value eq ${myId})`,
    orderBy: ['createdon asc'],
  });
  const rows = res.data || [];
  const unread = rows.filter(r => r._hs_sender_value === otherId && r._hs_receiver_value === myId && !r.hs_sread);
  if (unread.length) {
    await Promise.all(unread.map(r => Hs_messagesService.update(r.hs_messageid, { hs_sread: true })));
  }
  return rows.map(toMessage);
}

export async function sendChatMessage(senderId, receiverId, content, isEmergency) {
  await Hs_messagesService.create({
    'hs_Sender@odata.bind': `/hs_users(${senderId})`,
    'hs_Receiver@odata.bind': `/hs_users(${receiverId})`,
    hs_message1: (content || 'Message').slice(0, 100),
    hs_ontent: content,
    hs_semergency: !!isEmergency,
    hs_sread: false,
  });
  return { id: `local-${Date.now()}`, senderId, receiverId, content, isEmergency: !!isEmergency, isRead: false, createdAt: new Date().toISOString() };
}
