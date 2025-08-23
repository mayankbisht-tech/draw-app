import { type Shape } from '../../components/types/types';

export const broadcastShape = (ws: WebSocket, shape: Shape) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'shape', shape }));
  }
};

export const broadcastDelete = (ws: WebSocket, id: string) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'delete', id }));
  }
};
