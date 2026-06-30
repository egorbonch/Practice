const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ message: 'No token' });
    const token = header.split(' ')[1]; // 'Bearer <token>'
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        res.status(403).json({ message: 'Token is invalid' });
    }
};
