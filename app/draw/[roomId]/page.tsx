"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';

interface BaseShape {
  id: string;
  color?: string;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scale?: number;
}
interface PencilShape extends BaseShape {
  type: "pencil";
  points: { x: number; y: number }[];
  x: number;
  y: number;
}
interface RectangleShape extends BaseShape {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}
interface CircleShape extends BaseShape {
  type: "circle";
  x: number;
  y: number;
  radius: number;
}
interface LineShape extends BaseShape {
  type: "line";
  x: number;
  y: number;
  x2: number;
  y2: number;
}
interface TextShape extends BaseShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
}
export type Shape = PencilShape | RectangleShape | CircleShape | LineShape | TextShape;

interface ChatMessage {
  id: string;
  senderId: string;
  senderFirstName: string;
  senderLastName: string;
  text: string;
  timestamp: number;
}
type Tool = "pencil" | "rectangle" | "circle" | "line" | "eraser" | "text";

const degToRad = (degrees: number) => degrees * (Math.PI / 180);
class Complex {
  re: number;
  im: number;
  constructor(re: number, im: number) { this.re = re; this.im = im; }
  add(other: Complex): Complex { return new Complex(this.re + other.re, this.im + other.im); }
  subtract(other: Complex): Complex { return new Complex(this.re - other.re, this.im - other.im); }
  multiply(other: Complex): Complex { return new Complex(this.re * other.re - this.im * other.im, this.re * other.im + this.im * other.re); }
  static fromPolar(magnitude: number, angleRadians: number): Complex { return new Complex(magnitude * Math.cos(angleRadians), magnitude * Math.sin(angleRadians)); }
  get magnitude(): number { return Math.sqrt(this.re * this.re + this.im * this.im); }
  get angle(): number { return Math.atan2(this.im, this.re); }
}
const getShapeCenter = (shape: Shape): { x: number; y: number } => {
  let centerX: number;
  let centerY: number;
  if (shape.type === 'rectangle') { centerX = shape.x + shape.width / 2; centerY = shape.y + shape.height / 2; }
  else if (shape.type === 'circle') { centerX = shape.x; centerY = shape.y; }
  else if (shape.type === 'line') { centerX = (shape.x + shape.x2) / 2; centerY = (shape.y + shape.y2) / 2; }
  else if (shape.type === 'pencil' && shape.points.length > 0) { const minX = Math.min(...shape.points.map(p => p.x)); const minY = Math.min(...shape.points.map(p => p.y)); const maxX = Math.max(...shape.points.map(p => p.x)); const maxY = Math.max(...shape.points.map(p => p.y)); centerX = minX + (maxX - minX) / 2; centerY = minY + (maxY - minY) / 2; }
  else if (shape.type === 'text') { const approxWidth = shape.text.length * (shape.fontSize || 12) * 0.5; centerX = shape.x + approxWidth / 2; centerY = shape.y - (shape.fontSize || 12) / 2; }
  else { centerX = shape.x; centerY = shape.y; }
  return { x: centerX, y: centerY };
};
const getLocalMouseCoordinates = (coords: { x: number; y: number }, shape: Shape, ctx: CanvasRenderingContext2D) => {
  ctx.save();
  const { x: shapeCenterX, y: shapeCenterY } = getShapeCenter(shape);
  ctx.translate(shapeCenterX + (shape.offsetX || 0), shapeCenterY + (shape.offsetY || 0));
  ctx.rotate(shape.rotation || 0);
  ctx.scale(shape.scale || 1, shape.scale || 1);
  ctx.translate(-shapeCenterX, -shapeCenterY);
  const invTransform = ctx.getTransform().inverse();
  ctx.restore();
  return { x: coords.x * invTransform.a + coords.y * invTransform.c + invTransform.e, y: coords.x * invTransform.b + coords.y * invTransform.d + invTransform.f };
};

export default function Imp() {
  const router = useRouter();
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const params = useParams();
  const roomId = params.roomId as string;
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawingShapeId, setCurrentDrawingShapeId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [lineDragHandle, setLineDragHandle] = useState<'start' | 'end' | 'body' | null>(null);
  const transformStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const initialShapeStateRef = useRef<Shape | null>(null);
  const initialGestureStateRef = useRef<{ distance: number, angle: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const [isSidebarToggled, setIsSidebarToggled] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [userInfo, setUserInfo] = useState<{ id: string; name: string; token: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateId = useCallback(() => (crypto.randomUUID ? crypto.randomUUID() : `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`), []);

  useEffect(() => {
    const fetchAuthAndData = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          throw new Error('Not authenticated');
        }
        const meData = await meRes.json();
        setUserInfo({ id: meData.id, name: meData.name, token: meData.token });

        const wsUrl = 'wss://draw-app-olug.onrender.com';

        const socket = new WebSocket(`${wsUrl}/?roomId=${roomId}&token=${meData.token}`);
        ws.current = socket;

        socket.onopen = () => {
          console.log("WebSocket connection established.");
          setWsConnected(true);
          setIsPageLoading(false);

          fetch(`/api/room/${roomId}`).then(res => res.json()).then(data => {
            setShapes(data.shapes || []);
          });
        };
        socket.onclose = () => {
          console.log("WebSocket connection closed.");
          setWsConnected(false);
        };
        socket.onerror = (error) => console.error("WebSocket error:", error);

        socket.onmessage = async (event) => {
          const messageData = event.data instanceof Blob ? await event.data.text() : event.data;
          try {
            const data = JSON.parse(messageData);
            switch (data.type) {
              case 'init':
                break;
              case 'shape':
                setShapes((prev) => {
                  const i = prev.findIndex(s => s.id === data.shape.id);
                  if (i !== -1) {
                    const u = [...prev];
                    u[i] = { ...data.shape, offsetX: data.shape.offsetX ?? 0, offsetY: data.shape.offsetY ?? 0, rotation: data.shape.rotation ?? 0, scale: data.shape.scale ?? 1 };
                    return u;
                  }
                  return [...prev, { ...data.shape, offsetX: data.shape.offsetX ?? 0, offsetY: data.shape.offsetY ?? 0, rotation: data.shape.rotation ?? 0, scale: data.shape.scale ?? 1 }];
                });
                break;
              case 'delete':
                setShapes((prev) => prev.filter((s) => s.id !== data.id));
                break;
              case 'online_users_update':
                setOnlineUsers(prevUsers => {
  const incomingUsers = data.users || [];
  const uniqueUsers = new Map(incomingUsers.map((user: { id: string; name: string }) => [user.id, user]));
  return Array.from(uniqueUsers.values()) as { id: string; name: string }[];
});
                break;
              case 'chat_message':
                setMessages(prev => {
                  const isDuplicate = prev.some(m => m.id === data.message.id);
                  if (!isDuplicate) {
                    return [...prev, data.message];
                  }
                  return prev;
                });
                break;
              default:
                break;
            }
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };

        return () => {
          socket.close(1000, "Component unmounting");
        };

      } catch (error) {
        console.error("Authentication or data fetch failed:", error);
        router.push('/authentication/signin');
      }
    };

    fetchAuthAndData();

  }, [roomId, router]);

  useEffect(() => {
    const updateCanvasDimensions = () => {
      const margin = 80;
      setCanvasDimensions({ width: window.innerWidth - margin, height: window.innerHeight - 40 });
    };
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, []);

  const broadcastData = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log("Broadcasting data:", data);
      ws.current.send(JSON.stringify(data));
    } else {
      console.error("WebSocket is not connected. Message not sent.");
    }
  }, []);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect(); const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX; const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY; return { x: clientX - rect.left, y: clientY - rect.top }; };
  const hitTest = useCallback((x: number, y: number, shape: Shape, ctx: CanvasRenderingContext2D): boolean => {
    const localMouse = getLocalMouseCoordinates({ x, y }, shape, ctx);
    const tol = 10 / (shape.scale || 1);
    switch (shape.type) {
      case 'rectangle': return localMouse.x >= shape.x - tol && localMouse.x <= shape.x + shape.width + tol && localMouse.y >= shape.y - tol && localMouse.y <= shape.y + shape.height + tol;
      case 'circle': return Math.hypot(localMouse.x - shape.x, localMouse.y - shape.y) <= shape.radius + tol;
      case 'line': { const { x1, y1, x2, y2 } = { x1: shape.x, y1: shape.y, x2: shape.x2, y2: shape.y2 }; const dStart = Math.hypot(localMouse.x - x1, localMouse.y - y1); const dEnd = Math.hypot(localMouse.x - x2, localMouse.y - y2); if (dStart < tol || dEnd < tol) return true; const len = Math.hypot(x2 - x1, y2 - y1); if (len === 0) return dStart < tol; let t = ((localMouse.x - x1) * (x2 - x1) + (localMouse.y - y1) * (y2 - y1)) / (len * len); t = Math.max(0, Math.min(1, t)); const dx = localMouse.x - (x1 + t * (x2 - x1)); const dy = localMouse.y - (y1 + t * (y2 - y1)); return (dx * dx + dy * dy) < tol * tol; }
      case 'pencil': { if (!shape.points || shape.points.length < 2) return false; for (let i = 0; i < shape.points.length - 1; i++) { const p1 = shape.points[i]; const p2 = shape.points[i + 1]; const lenSq = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2; if (lenSq === 0) continue; let t = ((localMouse.x - p1.x) * (p2.x - p1.x) + (localMouse.y - p1.y) * (p2.y - p1.y)) / lenSq; t = Math.max(0, Math.min(1, t)); const dx = localMouse.x - (p1.x + t * (p2.x - p1.x)); const dy = localMouse.y - (p1.y + t * (p2.y - p1.y)); if ((dx * dx + dy * dy) <= tol * tol) return true; } return false; }
      case 'text': { const textWidth = ctx.measureText(shape.text).width; return (localMouse.x >= shape.x - tol && localMouse.x <= shape.x + textWidth + tol && localMouse.y >= shape.y - (shape.fontSize || 12) - tol && localMouse.y <= shape.y + tol); }
      default: return false;
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const clickedShape = shapes.slice().reverse().find(shape => hitTest(coords.x, coords.y, shape, ctx));

    if (clickedShape) {
      setSelectedShapeId(clickedShape.id);
    } else {
      setSelectedShapeId(null);
    }
  }, [shapes, hitTest]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const clickedShape = shapes.slice().reverse().find(shape => hitTest(coords.x, coords.y, shape, ctx));

    if (clickedShape && clickedShape.id === selectedShapeId) {
      setIsTransforming(true);
      initialShapeStateRef.current = { ...clickedShape };

      if ('touches' in e && e.touches.length === 2) {
        const t1 = e.touches[0]; const t2 = e.touches[1];
        initialGestureStateRef.current = {
          distance: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
          angle: Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX)
        };
      } else {
        transformStartPointRef.current = coords;
        if (clickedShape.type === 'line') {
          const localMouse = getLocalMouseCoordinates(coords, initialShapeStateRef.current!, ctx);
          const handleRadius = 15 / (clickedShape.scale || 1);
          if (Math.hypot(localMouse.x - clickedShape.x, localMouse.y - clickedShape.y) < handleRadius) setLineDragHandle('start');
          else if (Math.hypot(localMouse.x - clickedShape.x2, localMouse.y - clickedShape.y2) < handleRadius) setLineDragHandle('end');
          else setLineDragHandle('body');
        }
      }
      return;
    }

    if (selectedTool === 'eraser' && clickedShape) {
      setShapes(prev => prev.filter(s => s.id !== clickedShape.id));
      broadcastData({ type: 'delete', id: clickedShape.id });
      return;
    }

    setSelectedShapeId(null);
    if (selectedTool === 'text') {
      setIsTyping(true);
      setTextInputPosition({ x: coords.x + canvas.getBoundingClientRect().left, y: coords.y + canvas.getBoundingClientRect().top });
      setTextInputValue('');
      setCurrentDrawingShapeId(null);
      return;
    }
    if (selectedTool === 'eraser') return;

    setIsDrawing(true);
    startPointRef.current = coords;
    const newShapeId = generateId();
    const defaultTransform = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1, color: 'white' };
    let newShape: Shape;
    switch(selectedTool) {
      case 'pencil': newShape = { id: newShapeId, type: 'pencil', points: [coords], x: coords.x, y: coords.y, ...defaultTransform }; break;
      case 'rectangle': newShape = { id: newShapeId, type: 'rectangle', x: coords.x, y: coords.y, width: 0, height: 0, ...defaultTransform }; break;
      case 'circle': newShape = { id: newShapeId, type: 'circle', x: coords.x, y: coords.y, radius: 0, ...defaultTransform }; break;
      case 'line': newShape = { id: newShapeId, type: 'line', x: coords.x, y: coords.y, x2: coords.x, y2: coords.y, ...defaultTransform }; break;
      default: return;
    }
    setCurrentDrawingShapeId(newShapeId);
    setShapes(prev => [...prev, newShape]);
  }, [selectedTool, shapes, hitTest, broadcastData, generateId, selectedShapeId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const coords = getCoords(e);

    if (isTransforming && selectedShapeId && initialShapeStateRef.current) {
      setShapes(prev => prev.map(s => {
        if (s.id === selectedShapeId) {
          const updatedShape = { ...s };
          if ('touches' in e && e.touches.length === 2) {
            const t1 = e.touches[0]; const t2 = e.touches[1];
            const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const currentAngle = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX);
            if (initialGestureStateRef.current) {
              updatedShape.scale = (initialShapeStateRef.current!.scale || 1) * (currentDist / initialGestureStateRef.current.distance);
              updatedShape.rotation = (initialShapeStateRef.current!.rotation || 0) + (currentAngle - initialGestureStateRef.current.angle);
            }
          } else if (updatedShape.type === 'line' && lineDragHandle && lineDragHandle !== 'body') {
            const localMouse = getLocalMouseCoordinates(coords, initialShapeStateRef.current!, ctx);
            if (lineDragHandle === 'start') { updatedShape.x = localMouse.x; updatedShape.y = localMouse.y; }
            else { updatedShape.x2 = localMouse.x; updatedShape.y2 = localMouse.y; }
          } else {
            const altPressed = 'altKey' in e && e.altKey; const shiftPressed = 'shiftKey' in e && e.shiftKey;
            const center = getShapeCenter(initialShapeStateRef.current!);
            if (altPressed) {
              const startVec = new Complex(transformStartPointRef.current!.x - center.x, transformStartPointRef.current!.y - center.y);
              const currentVec = new Complex(coords.x - center.x, coords.y - center.y);
              updatedShape.rotation = (initialShapeStateRef.current!.rotation || 0) + (currentVec.angle - startVec.angle);
            } else if (shiftPressed && updatedShape.type !== 'line') {
              const initialDist = Math.hypot(transformStartPointRef.current!.x - center.x, transformStartPointRef.current!.y - center.y);
              const currentDist = Math.hypot(coords.x - center.x, coords.y - center.y);
              if (initialDist > 0) updatedShape.scale = (initialShapeStateRef.current!.scale || 1) * (currentDist / initialDist);
            } else {
              const deltaX = coords.x - transformStartPointRef.current!.x;
              const deltaY = coords.y - transformStartPointRef.current!.y;
              updatedShape.offsetX = (initialShapeStateRef.current!.offsetX || 0) + deltaX;
              updatedShape.offsetY = (initialShapeStateRef.current!.offsetY || 0) + deltaY;
            }
          }
          return updatedShape;
        }
        return s;
      }));
    } else if (isDrawing && currentDrawingShapeId) {
      setShapes(prev => prev.map(s => {
        if (s.id === currentDrawingShapeId) {
          const updatedShape = { ...s };
          const start = startPointRef.current!;
          switch (updatedShape.type) {
            case 'pencil':
              updatedShape.points = [...updatedShape.points, coords];
              break;
            case 'rectangle':
              updatedShape.x = Math.min(start.x, coords.x);
              updatedShape.y = Math.min(start.y, coords.y);
              updatedShape.width = Math.abs(start.x - coords.x);
              updatedShape.height = Math.abs(start.y - coords.y);
              break;
            case 'circle':
              updatedShape.x = (start.x + coords.x) / 2;
              updatedShape.y = (start.y + coords.y) / 2;
              updatedShape.radius = Math.hypot(coords.x - start.x, coords.y - start.y) / 2;
              break;
            case 'line':
              updatedShape.x2 = coords.x;
              updatedShape.y2 = coords.y;
              break;
          }
          return updatedShape;
        }
        return s;
      }));
    }
  }, [isDrawing, isTransforming, selectedShapeId, lineDragHandle, currentDrawingShapeId]);

  const handleEndDrawing = useCallback(() => {
    const finalShapeId = isDrawing ? currentDrawingShapeId : selectedShapeId;
    if (finalShapeId) {
      const finalShape = shapes.find(s => s.id === finalShapeId);
      if (finalShape) {
        broadcastData({ type: 'shape', shape: finalShape });
      }
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setLineDragHandle(null);
    setCurrentDrawingShapeId(null);
    initialGestureStateRef.current = null;
  }, [isDrawing, isTransforming, shapes, broadcastData, selectedShapeId, currentDrawingShapeId]);
  const handleTextInputBlur = useCallback(() => {
    if (isTyping && textInputValue.trim() !== '') {
      const newShapeId = currentDrawingShapeId || generateId();
      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const newTextShape: Shape = {
        id: newShapeId, type: 'text', x: textInputPosition!.x - canvasRect.left, y: textInputPosition!.y - canvasRect.top + 20,
        text: textInputValue.trim(), fontSize: 24, fontFamily: 'Arial', color: 'white',
        offsetX: 0, offsetY: 0, rotation: 0, scale: 1
      };
      if (currentDrawingShapeId) {
        setShapes(prev => prev.map(s => s.id === currentDrawingShapeId ? newTextShape : s));
      } else {
        setShapes(prev => [...prev, newTextShape]);
      }
      broadcastData({ type: 'shape', shape: newTextShape });
    }
    setIsTyping(false);
    setTextInputPosition(null);
    setTextInputValue('');
    setCurrentDrawingShapeId(null);
  }, [isTyping, textInputPosition, textInputValue, currentDrawingShapeId, generateId, broadcastData]);
  const handleTextInputKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); }, []);
  const handleSendMessage = useCallback(
  (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (inputValue.trim() === '' || !userInfo) {
      console.error("Cannot send message: No user info available or input is empty.");
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      const chatMessage: ChatMessage = {
        id: generateId(),
        senderId: userInfo.id,
        senderFirstName: userInfo.name,
        senderLastName: '',
        text: inputValue.trim(),
        timestamp: Date.now(),
      };

      console.log("Sending chat message:", chatMessage);

      setMessages((prev) => [...prev, chatMessage]);

      ws.current.send(
        JSON.stringify({
          type: "chat_message",
          message: chatMessage,
        })
      );

      setInputValue("");
    } else {
      console.error("WebSocket is not connected. Message not sent.");
    }
  },
  [inputValue, userInfo, generateId]
);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      shapes.forEach(shape => {
        ctx.save();
        const { x: shapeCenterX, y: shapeCenterY } = getShapeCenter(shape);
        ctx.translate(shapeCenterX + (shape.offsetX || 0), shapeCenterY + (shape.offsetY || 0));
        ctx.rotate(shape.rotation || 0);
        ctx.scale(shape.scale || 1, shape.scale || 1);
        ctx.translate(-shapeCenterX, -shapeCenterY);

        if (shape.id === selectedShapeId) {
          ctx.strokeStyle = '#2563EB'; 
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);

          let minX, minY, maxX, maxY;
          switch(shape.type) {
            case 'rectangle':
              minX = shape.x; minY = shape.y;
              maxX = shape.x + shape.width; maxY = shape.y + shape.height;
              break;
            case 'circle':
              minX = shape.x - shape.radius; minY = shape.y - shape.radius;
              maxX = shape.x + shape.radius; maxY = shape.y + shape.radius;
              break;
            case 'line':
              minX = Math.min(shape.x, shape.x2); minY = Math.min(shape.y, shape.y2);
              maxX = Math.max(shape.x, shape.x2); maxY = Math.max(shape.y, shape.y2);
              break;
            case 'pencil':
              const xCoords = shape.points.map(p => p.x);
              const yCoords = shape.points.map(p => p.y);
              minX = Math.min(...xCoords); minY = Math.min(...yCoords);
              maxX = Math.max(...xCoords); maxY = Math.max(...yCoords);
              break;
            case 'text':
              const textWidth = ctx.measureText(shape.text).width;
              minX = shape.x; minY = shape.y - (shape.fontSize || 12);
              maxX = shape.x + textWidth; maxY = shape.y;
              break;
            default:
              break;
          }

          if (minX != null && minY != null && maxX != null && maxY != null) {
            const padding = 5;
            ctx.strokeRect(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
          }

          ctx.setLineDash([]);
        }

        ctx.strokeStyle = shape.color || '#FFFFFF';
        ctx.lineWidth = 2;

        switch (shape.type) {
          case 'rectangle':
            ctx.beginPath();
            ctx.rect(shape.x, shape.y, shape.width, shape.height);
            ctx.stroke();
            break;
          case 'circle':
            ctx.beginPath();
            ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
            ctx.stroke();
            break;
          case 'line':
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
            break;
          case 'pencil':
            if (shape.points.length > 1) {
              ctx.beginPath();
              ctx.moveTo(shape.points[0].x, shape.points[0].y);
              shape.points.forEach(point => ctx.lineTo(point.x, point.y));
              ctx.stroke();
            }
            break;
          case 'text':
            ctx.fillStyle = shape.color || '#FFFFFF';
            ctx.font = `${shape.fontSize || 24}px ${shape.fontFamily || 'Arial'}`;
            ctx.fillText(shape.text, shape.x, shape.y);
            break;
        }
        ctx.restore();
      });
    };

    render();
  }, [shapes, selectedShapeId]);

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black font-inter flex">

  {!isSidebarToggled && (
    <button
      onClick={() => setIsSidebarToggled(true)}
      className="fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-md"
      aria-label="Open Sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  )}

  <Sidebar
    onBackdropClick={() => setIsSidebarToggled(false)}
    toggled={isSidebarToggled}
    breakPoint="all"
    backgroundColor="#18181b"
    width="280px"
    rootStyles={{
      position: "fixed",
      height: "100%",
      borderRight: "1px solid rgb(39 39 42)",
      zIndex: 60,
    }}
  >
    <Menu
      className="flex flex-col h-full"
      menuItemStyles={{
        button: {
          [`&:hover`]: {
            backgroundColor: "rgb(39 39 42)",
            color: "white",
          },
          borderRadius: "8px",
          margin: "4px 8px",
          transition: "all 0.2s ease-in-out",
        },
      }}
    >
      <div className="flex-shrink-0 border-b border-zinc-800 p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Drawing Room</h2>
          <button
            onClick={() => setIsSidebarToggled(false)}
            className="p-1 rounded-full text-gray-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Close Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 mt-2 space-y-1">
        <MenuItem
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          className="text-gray-200"
        >
          {userInfo ? `You: ${userInfo.name}` : "Connecting..."}
        </MenuItem>

        <MenuItem
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
          }
          className="text-gray-400"
          onClick={() => router.push("/dashboard")}
        >
          Go to Dashboard
        </MenuItem>
      </div>

      <div className="flex-grow overflow-y-auto mt-2 border-t border-zinc-800">
        <SubMenu
          label="Online Players"
          defaultOpen
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 
                 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 
                 3 3 0 016 0zm6 3a2 2 0 11-4 0 
                 2 2 0 014 0zM7 10a2 2 0 11-4 
                 0 2 2 0 014 0z"
              />
            </svg>
          }
          className="text-gray-400"
        >
          {onlineUsers.length > 0 ? (
            onlineUsers.map((user) => (
              <MenuItem key={user.id} className="text-gray-300">
                {user.name} {user.id === userInfo?.id ? "(You)" : ""}
              </MenuItem>
            ))
          ) : (
            <MenuItem key="no-users" className="text-gray-500">
              Only you
            </MenuItem>
          )}
        </SubMenu>
      </div>

<div className="flex-shrink-0 p-2 border-t border-gray-700 flex flex-col h-full overflow-hidden">
  <div className="flex-1 overflow-y-auto space-y-2 p-2 rounded-md bg-gray-800 border border-gray-700 mb-2">
    {messages.map((message) => {
      const isOwnMessage = userInfo?.id && message.senderId === userInfo.id;

      return (
        <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
          <div className="flex flex-col max-w-xs">
            {!isOwnMessage && (
              <p className="text-xs text-gray-400 px-1 self-start font-bold">
                {message.senderFirstName}
              </p>
            )}
            <div
              className={`py-1 px-3 mt-1 rounded-2xl break-words text-sm ${
                isOwnMessage
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-600 text-white rounded-bl-none"
              }`}
            >
              {message.text}
            </div>
          </div>
        </div>
      );
    })}
    <div ref={messagesEndRef} />
  </div>

  <form className="flex items-center gap-2" onSubmit={handleSendMessage}>
    <input
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder="Type a message..."
      className="flex-grow rounded-md p-2 bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <button
      type="submit"
      className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition-colors duration-200"
    >
      Send
    </button>
  </form>
</div>

    </Menu>
  </Sidebar>

  <main
    className={`flex-1 flex flex-col items-center justify-center p-5 transition-all duration-300 ${
      isSidebarToggled ? "ml-[280px]" : ""
    }`}
  >
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap gap-2 p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {(["pencil", "line", "rectangle", "circle", "text", "eraser"] as const).map((tool) => (
          <button
            key={tool}
            className={`text-white capitalize px-4 py-2 rounded-md shadow-md transition-colors duration-200 ${
              selectedTool === tool ? "bg-gray-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
            onClick={() => setSelectedTool(tool)}
          >
            {tool}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEndDrawing}
        onMouseLeave={handleEndDrawing}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleEndDrawing}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        className="bg-black rounded-lg shadow-xl border border-gray-800"
        style={{
          width: `${canvasDimensions.width}px`,
          height: `${canvasDimensions.height}px`,
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
    </div>

    {isTyping && textInputPosition && (
      <input
        type="text"
        value={textInputValue}
        onChange={(e) => setTextInputValue(e.target.value)}
        onBlur={handleTextInputBlur}
        onKeyPress={handleTextInputKeyPress}
        autoFocus
        style={{ position: "absolute", left: textInputPosition.x, top: textInputPosition.y, zIndex: 30 }}
        className="focus:outline-none p-2 rounded bg-gray-900 border border-white text-white text-lg"
      />
    )}
  </main>
</div>

  );
}
