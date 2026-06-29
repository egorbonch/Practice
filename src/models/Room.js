const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Room = sequelize.define('Room', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    type: { type: DataTypes.ENUM('private', 'group'), defaultValue: 'private' },
    createdBy: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'rooms' });

module.exports = Room;
