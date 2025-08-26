import { WebSocketServer } from 'ws';
import http from 'http';
import url from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "123123";
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

const rooms = new Map(); 
const users = new Map(); 

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Real-time WebSocket server is active.');
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  const { roomId, token } = url.parse(request.url, true).query;

  if (!roomId || !token) {
      ws.close(1008, 'Room ID and a valid token are required.');
      return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const userFirstName = decoded.userFirstName;

    console.log(`[Connection] User '${userFirstName}' (${userId}) connected to room '${roomId}'.`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const room = rooms.get(roomId);
    room.add(ws);
    users.set(ws, { id: userId, name: userFirstName, roomId });

    const broadcastUsers = () => {
      const roomUsers = Array.from(room)
        .map(client => users.get(client))
        .filter(Boolean); 

      const message = JSON.stringify({ type: 'online_users_update', users: roomUsers });
      room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    };

    broadcastUsers();

    ws.on('message', (message) => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom) return;

      currentRoom.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      });
    });

    ws.on('close', () => {
      console.log(`[Disconnection] User '${userFirstName}' (${userId}) disconnected from room '${roomId}'.`);
      const roomOnClose = rooms.get(roomId);
      if (roomOnClose) {
          roomOnClose.delete(ws);
          users.delete(ws);
          
          if (roomOnClose.size === 0) {
              rooms.delete(roomId);
              console.log(`[Room Empty] Room '${roomId}' is now empty and has been removed from memory.`);
          } else {
              broadcastUsers();
          }
      }
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket Error] in room '${roomId}':`, err);
    });

  } catch (err) {
    console.error(`[Authentication Error] JWT verification failed: ${err.message}`);
    ws.close(1008, 'Authentication failed: Invalid token.');
  }
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url);
  
  if (pathname === '/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HTTP/WebSocket server is running on port ${PORT}`);
});
