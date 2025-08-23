const { WebSocketServer } = require('ws');
const url = require('url');

const rooms = new Map();

const wss = new WebSocketServer({ port: 8080 });

console.log('WebSocket server started on port 8080');

wss.on('connection', (ws, req) => {
  const parameters = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
  const roomId = parameters.get('roomId');

  if (!roomId) {
    console.log('Connection rejected: No roomId provided.');
    ws.close();
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, { connections: new Set(), shapes: [] });
  }
  const room = rooms.get(roomId);
  room.connections.add(ws);

  console.log(`Client connected to room: ${roomId}. Total clients: ${room.connections.size}`);

  ws.send(JSON.stringify({ type: 'init', shapes: room.shapes }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'shape') {
        const shapeIndex = room.shapes.findIndex(s => s.id === data.shape.id);
        if (shapeIndex > -1) {
          room.shapes[shapeIndex] = data.shape;
        } else {
          room.shapes.push(data.shape);
        }
      } else if (data.type === 'delete') {
         room.shapes = room.shapes.filter(s => s.id !== data.id);
      }

      for (const client of room.connections) {
        if (client.readyState === 1) { 
          client.send(JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Failed to process message:', error);
    }
  });

  ws.on('close', () => {
    room.connections.delete(ws);
    console.log(`Client disconnected from room: ${roomId}. Total clients: ${room.connections.size}`);
    
    if (room.connections.size === 0) {
      console.log(`Room ${roomId} is empty, removing.`);
      rooms.delete(roomId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error on connection:', error);
  });
});
