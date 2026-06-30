const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const authMW = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');

// POST /api/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ message: 'All fields are required.' });
        const exists = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
        if (exists) return res.status(409).json({ message: 'The name or email is already taken.' });
        const hash = await bcrypt.hash(password, 12);
        const user = await User.create({ username, email, password: hash });
        const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: user.id, username } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                message: "Username or password are required"
            });
        }
        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(401).json({ message: 'User not found' });
        const ok = await bcrypt.compare(password, user.password);
        await user.update({ isOnline: true, lastSeen: new Date() });
        const token = jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/users
router.get('/users', authMW, async (req, res) => {
    const users = await User.findAll({
        attributes: ['id', 'username', 'isOnline', 'lastSeen'],
        where: { id: { [Op.ne]: req.user.id } },
    });
    res.json(users);
});

// GET /api/messages/:userId
router.get('/messages/:userId', authMW, async (req, res) => {
    const { userId } = req.params; const me = req.user.id;
    const msgs = await Message.findAll({
        where: { [Op.or]: [{ senderId: me, receiverId: userId }, { senderId: userId, receiverId: me }] },
        order: [['createdAt', 'ASC']], limit: 200,
    });
    await Message.update({ isRead: true }, { where: { senderId: userId, receiverId: me, isRead: false } });
    res.json(msgs);
});

// POST /api/logout
router.post('/logout', authMW, async (req, res) => {
    await User.update({ isOnline: false, lastSeen: new Date() }, { where: { id: req.user.id } });
    res.json({ ok: true });
});

module.exports = router;

