import dotenv from 'dotenv';
import app from './app';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
// Compatibility: allow DB_URL to satisfy Prisma's DATABASE_URL
if (!process.env.DATABASE_URL && (process.env as any).DB_URL) {
  (process.env as any).DATABASE_URL = (process.env as any).DB_URL as string;
}

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 5000);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
(app as any).set('io', io);

io.on('connection', (socket) => {
  // simple heartbeat
  socket.emit('connected');
});

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
