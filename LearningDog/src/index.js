const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const recordRoutes = require('./routes/records');
const { setupSocket } = require('./socket/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/records', recordRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'LearningDog server is running' });
});

setupSocket(io);

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
server.listen(PORT, HOST, () => {
  console.log(`LearningDog server running on http://${HOST}:${PORT}`);
});
