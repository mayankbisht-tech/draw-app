
let socket: WebSocket | null = null;

export const connectWebSocket = (roomId: string, onDraw: (shape: any) => void) => {
  socket = new WebSocket("8080");

  socket.onopen = () => {
    console.log("WebSocket connected");

    socket?.send(
      JSON.stringify({
        type: "join-room",
        roomId,
      })
    );
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "draw") {
      onDraw(data.shape);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
  };
};

export const sendShape = (shape: any) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "draw",
        shape,
      })
    );
  }
};
