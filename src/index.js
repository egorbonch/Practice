require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./config/db');
const { setupWebSocket } = require('./services/wsService');
const { setupSoap } = require('./services/soapService');
const apiRouter = require('./routes/api');

require('./models/User');
require('./models/Message');
require('./models/Room');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(bodyParser.text({ type: '*/xml' }));
app.use('/api', apiRouter);
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

setupWebSocket(server);
setupSoap(app);

const PORT = process.env.PORT || 3000;
sequelize.sync({ alter: false }).then(() => {
    server.listen(PORT, () => console.log(`The backend is running on port ${PORT}`));
}).catch(e => { console.error(e); process.exit(1); });
