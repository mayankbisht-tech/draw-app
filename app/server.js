const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');
const jwt = require('jsonwebtoken');

const JWT_SECRET = '123123'; 

const rooms = new Map();
const users = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  const { roomId, token } = url.parse(request.url, true).query;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const userFirstName = decoded.userFirstName;
    
    console.log(`[Server Debug] Connection successful to room ${roomId}. User ID: ${userId}, Name: ${userFirstName}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const room = rooms.get(roomId);
    room.add(ws);
    users.set(ws, { id: userId, name: userFirstName, roomId });

    const broadcastUsers = () => {
      const roomUsers = Array.from(room).map(client => {
        const user = users.get(client);
        return { id: user.id, name: user.name };
      });
      room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'online_users_update', users: roomUsers }));
        }
      });
    };

    broadcastUsers();

    ws.on('message', message => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'shape' || data.type === 'delete' || data.type === 'chat_message') {
          room.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse message or handle:', e);
      }
    });

    ws.on('close', () => {
      room.delete(ws);
      users.delete(ws);
      if (room.size === 0) {
        rooms.delete(roomId);
      }
      broadcastUsers();
      console.log(`[Server Debug] User disconnected from room ${roomId}. Users left: ${room.size}`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });

  } catch (err) {
    console.error(`JWT verification failed: ${err.name}: ${err.message}`);
    ws.close(1008, 'Authentication failed');
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

server.listen(8080, () => {
  console.log('HTTP/WebSocket server is running on port 8080');
});