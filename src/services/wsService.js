const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');

// userId -> Set<ws>  (один юзер может быть открыт в нескольких вкладках)
const clients = new Map();

function send(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function broadcast(userId, obj) {
    const sockets = clients.get(userId);
    if (sockets) sockets.forEach(ws => send(ws, obj));
}

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    // Ping всех каждые 30 с (keep-alive)
    const interval = setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) { ws.terminate(); return; }
            ws.isAlive = false; ws.ping();
        });
    }, 30000);
    wss.on('close', () => clearInterval(interval));

    wss.on('connection', (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        let userId = null;

        ws.on('message', async (raw) => {
            let msg; try { msg = JSON.parse(raw); } catch { return; }

            // AUTH
            if (msg.type === 'AUTH') {
                try {
                    const payload = jwt.verify(msg.token, process.env.JWT_SECRET);
                    userId = payload.id;
                    if (!clients.has(userId)) clients.set(userId, new Set());
                    clients.get(userId).add(ws);
                    await User.update({ isOnline: true }, { where: { id: userId } });
                    send(ws, { type: 'AUTH_OK', userId });
                } catch { send(ws, { type: 'AUTH_FAIL', message: 'Invalid token' }); }
                return;
            }

            if (!userId) { send(ws, { type: 'ERROR', message: 'Not authenticated' }); return; }

            // SEND_MESSAGE
            if (msg.type === 'SEND_MESSAGE') {
                const { receiverId, content } = msg;
                if (!content?.trim()) return;
                const saved = await Message.create({ senderId: userId, receiverId, content });
                const data = {
                    type: 'NEW_MESSAGE', message: {
                        id: saved.id, senderId: userId,
                        receiverId, content, createdAt: saved.createdAt, isRead: false
                    }
                };
                broadcast(receiverId, data);
                broadcast(userId, { ...data, type: 'MSG_SENT' });
            }

            // TYPING
            if (msg.type === 'TYPING')
                broadcast(msg.receiverId, { type: 'TYPING', senderId: userId, isTyping: msg.isTyping });

            // READ_RECEIPT
            if (msg.type === 'READ_RECEIPT') {
                await Message.update({ isRead: true }, { where: { senderId: msg.senderId, receiverId: userId, isRead: false } });
                broadcast(msg.senderId, { type: 'MESSAGES_READ', by: userId });
            }

        });

        ws.on('close', async () => {
            if (userId) {
                const set = clients.get(userId);
                if (set) { set.delete(ws); if (!set.size) clients.delete(userId); }
                if (!clients.has(userId))
                    await User.update({ isOnline: false, lastSeen: new Date() }, { where: { id: userId } });
            }
        });
    });
}

module.exports = { setupWebSocket };
