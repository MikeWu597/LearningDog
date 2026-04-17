const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const recordRoutes = require('./routes/records');
const { setupSocket } = require('./socket/index');
const { createMediaRelayServer } = require('./socket/mediaRelay');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 5000,
  pingTimeout: 10000,
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/records', recordRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'LearningDog server is running' });
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

async function start() {
  const mediaRelay = await createMediaRelayServer(io);
  setupSocket(io, mediaRelay);

  server.listen(PORT, HOST, () => {
    console.log(`LearningDog server running on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start LearningDog server', err);
  process.exit(1);
});
