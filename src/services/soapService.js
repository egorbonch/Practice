const soap = require('soap');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const { Op } = require('sequelize');

const wsdl = fs.readFileSync(path.join(__dirname, '../wsdl/messenger.wsdl'), 'utf8');

const service = {
    MessengerService: {
        MessengerPort: {
            // Отправить сообщение через SOAP
            sendMessage: async ({ senderId, receiverId, content, token }) => {
                try { jwt.verify(token, process.env.JWT_SECRET); }
                catch { return { messageId: '', status: 'UNAUTHORIZED', timestamp: '' }; }
                const msg = await Message.create({ senderId, receiverId, content });
                return { messageId: msg.id, status: 'OK', timestamp: msg.createdAt.toISOString() };
            },
            // Получить историю через SOAP
            getHistory: async ({ userId, withUserId, token, limit }) => {
                try { jwt.verify(token, process.env.JWT_SECRET); }
                catch { return { messages: '[]', count: 0 }; }
                const msgs = await Message.findAll({
                    where: { [Op.or]: [{ senderId: userId, receiverId: withUserId }, { senderId: withUserId, receiverId: userId }] },
                    order: [['createdAt', 'DESC']], limit: limit || 50,
                });
                return { messages: JSON.stringify(msgs), count: msgs.length };
            },
        }
    }
};

function setupSoap(app) {
    soap.listen(app, '/soap', service, wsdl, () => console.log('SOAP ready at /soap'));
}

module.exports = { setupSoap };