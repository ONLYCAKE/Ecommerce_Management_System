import dotenv from 'dotenv';
import app from './app.js';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
// Compatibility: allow DB_URL to satisfy Prisma's DATABASE_URL
if (!process.env.DATABASE_URL && process.env.DB_URL) {
  process.env.DATABASE_URL = process.env.DB_URL;
}

const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => {
  // simple heartbeat
  socket.emit('connected');
});

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
