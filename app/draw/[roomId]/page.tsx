"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';

// --- No changes to interfaces ---
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

const getShapeCenter = (shape: Shape): { x: number; y: number } => {
  if (!shape || !shape.type) {
    throw new Error("Invalid shape provided to getShapeCenter");
  }

  let centerX: number;
  let centerY: number;

  switch (shape.type) {
    case 'rectangle':
      centerX = shape.x + shape.width / 2;
      centerY = shape.y + shape.height / 2;
      break;
    case 'circle':
      centerX = shape.x;
      centerY = shape.y;
      break;
    case 'line':
      centerX = (shape.x + shape.x2) / 2;
      centerY = (shape.y + shape.y2) / 2;
      break;
    case 'text':
      const text = shape.text || "";
      const approxWidth = text.length * (shape.fontSize || 12) * 0.5;
      centerX = shape.x + approxWidth / 2;
      centerY = shape.y - (shape.fontSize || 12) / 2;
      break;
    case 'pencil':
      if (shape.points && shape.points.length > 0) {
        const minX = Math.min(...shape.points.map(p => p.x));
        const minY = Math.min(...shape.points.map(p => p.y));
        const maxX = Math.max(...shape.points.map(p => p.x));
        const maxY = Math.max(...shape.points.map(p => p.y));
        centerX = minX + (maxX - minX) / 2;
        centerY = minY + (maxY - minY) / 2;
      } else {
        centerX = shape.x;
        centerY = shape.y;
      }
      break;
    default:
      const _exhaustiveCheck: never = shape;
      throw new Error(`Unhandled shape type: ${(_exhaustiveCheck as Shape).type}`);
  }

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
  const params = useParams();
  const roomId = params.roomId as string;

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawingShapeId, setCurrentDrawingShapeId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [userInfo, setUserInfo] = useState<{ id: string; name: string; token: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [isTyping, setIsTyping] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  // FIX: Removed unused state variables that caused warnings.
  // const [_lineDragHandle, _setLineDragHandle] = useState<'start' | 'end' | 'body' | null>(null);
  const [isSidebarToggled, setIsSidebarToggled] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const transformStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const initialShapeStateRef = useRef<Shape | null>(null);
  
  const generateId = useCallback(() => crypto.randomUUID(), []);

  const persistShapes = useCallback(async (updatedShapes: Shape[]) => {
      try {
          await fetch(`/api/room/${roomId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shapes: updatedShapes }),
          });
      } catch (error) {
          console.error("Failed to persist shapes to the database:", error);
      }
  }, [roomId]);

  // --- No changes to useEffects or most handlers ---
  
  useEffect(() => {
    const initialize = async () => {
      if (!roomId) return;

      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) throw new Error('Authentication failed');
        const meData = await meRes.json();
        setUserInfo({ id: meData.id, name: meData.name, token: meData.token });

        const roomRes = await fetch(`/api/room/${roomId}`);
        if (roomRes.ok) {
            const roomData = await roomRes.json();
            setShapes(roomData.shapes || []);
        } else {
            console.error("Could not fetch initial room data from the server.");
        }

        const wsUrl = 'wss://draw-app-olug.onrender.com';
        const socket = new WebSocket(`${wsUrl}/?roomId=${roomId}&token=${meData.token}`);
        ws.current = socket;

        socket.onopen = () => {
          console.log("Real-time connection established.");
          setIsPageLoading(false);
        };

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
           switch (data.type) {
              case 'shape':
                setShapes(prev => {
                  const index = prev.findIndex(s => s.id === data.shape.id);
                  if (index !== -1) {
                    const newShapes = [...prev];
                    newShapes[index] = data.shape;
                    return newShapes;
                  }
                  return [...prev, data.shape];
                });
                break;
              case 'delete':
                setShapes(prev => prev.filter(s => s.id !== data.id));
                break;
              case 'clear_canvas':
                setShapes([]);
                break;
              case 'online_users_update':
                setOnlineUsers(data.users || []);
                break;
              case 'chat_message':
                 setMessages(prev => [...prev, data.message]);
                 break;
            }
        };
        
        socket.onclose = () => console.log("Real-time connection closed.");
        socket.onerror = (error) => console.error("WebSocket Error:", error);

      } catch (error) {
        console.error("Initialization failed:", error);
        router.push('/authentication/signin');
      }
    };

    initialize();

    return () => {
      ws.current?.close();
    };
  }, [roomId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      const margin = 80;
      setCanvasDimensions({ width: window.innerWidth - margin, height: window.innerHeight - 40 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const broadcastData = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
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
      case 'text': {
        if (!shape.text) return false; 
        const textWidth = ctx.measureText(shape.text).width;
        return (localMouse.x >= shape.x - tol && localMouse.x <= shape.x + textWidth + tol && localMouse.y >= shape.y - (shape.fontSize || 12) - tol && localMouse.y <= shape.y + tol);
      }
      default: return false;
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const clickedShape = [...shapes].reverse().find(shape => hitTest(coords.x, coords.y, shape, ctx));
    setSelectedShapeId(clickedShape ? clickedShape.id : null);
  }, [shapes, hitTest]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const clickedShape = [...shapes].reverse().find(shape => hitTest(coords.x, coords.y, shape, ctx));

    if (clickedShape && clickedShape.id === selectedShapeId) {
      setIsTransforming(true);
      initialShapeStateRef.current = { ...clickedShape };
      transformStartPointRef.current = coords;
      return;
    }

    if (selectedTool === 'eraser' && clickedShape) {
      const updatedShapes = shapes.filter(s => s.id !== clickedShape.id);
      setShapes(updatedShapes);
      broadcastData({ type: 'delete', id: clickedShape.id });
      persistShapes(updatedShapes);
      return;
    }

    setSelectedShapeId(null);
    if (selectedTool === 'text') {
      setIsTyping(true);
      setTextInputPosition({ x: coords.x + canvas.getBoundingClientRect().left, y: coords.y + canvas.getBoundingClientRect().top });
      setTextInputValue('');
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
  }, [selectedTool, shapes, hitTest, broadcastData, generateId, selectedShapeId, persistShapes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing && !isTransforming) return;
    const coords = getCoords(e);

    setShapes(prev => prev.map(s => {
      if (isTransforming && s.id === selectedShapeId && initialShapeStateRef.current) {
        const updatedShape = { ...s };
        const deltaX = coords.x - transformStartPointRef.current!.x;
        const deltaY = coords.y - transformStartPointRef.current!.y;
        updatedShape.offsetX = (initialShapeStateRef.current!.offsetX || 0) + deltaX;
        updatedShape.offsetY = (initialShapeStateRef.current!.offsetY || 0) + deltaY;
        return updatedShape;
      }
      if (isDrawing && s.id === currentDrawingShapeId) {
        const updatedShape = { ...s };
        const start = startPointRef.current!;
        switch (updatedShape.type) {
          case 'pencil': updatedShape.points.push(coords); break;
          case 'rectangle':
            updatedShape.x = Math.min(start.x, coords.x);
            updatedShape.y = Math.min(start.y, coords.y);
            updatedShape.width = Math.abs(start.x - coords.x);
            updatedShape.height = Math.abs(start.y - coords.y);
            break;
          case 'circle':
            updatedShape.radius = Math.hypot(coords.x - start.x, coords.y - start.y);
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
  }, [isDrawing, isTransforming, selectedShapeId, currentDrawingShapeId]);

  const handleEndDrawing = useCallback(() => {
    if (isDrawing || isTransforming) {
        const finalShapeId = isDrawing ? currentDrawingShapeId : selectedShapeId;
        const finalShape = shapes.find(s => s.id === finalShapeId);
        if (finalShape) {
            broadcastData({ type: 'shape', shape: finalShape });
        }
        persistShapes(shapes);
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setCurrentDrawingShapeId(null);
    initialShapeStateRef.current = null;
  }, [isDrawing, isTransforming, shapes, broadcastData, selectedShapeId, currentDrawingShapeId, persistShapes]);

  const handleTextInputBlur = useCallback(() => {
    if (isTyping && textInputValue.trim() !== '') {
      const newShapeId = generateId();
      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const newTextShape: Shape = {
        id: newShapeId, type: 'text', x: textInputPosition!.x - canvasRect.left, y: textInputPosition!.y - canvasRect.top + 20,
        text: textInputValue.trim(), fontSize: 24, fontFamily: 'Arial', color: 'white',
        offsetX: 0, offsetY: 0, rotation: 0, scale: 1
      };
      const updatedShapes = [...shapes, newTextShape];
      setShapes(updatedShapes);
      broadcastData({ type: 'shape', shape: newTextShape });
      persistShapes(updatedShapes);
    }
    setIsTyping(false);
    setTextInputPosition(null);
    setTextInputValue('');
  }, [isTyping, textInputPosition, textInputValue, shapes, generateId, broadcastData, persistShapes]);

  const handleSendMessage = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() === '' || !userInfo) return;
    
    const chatMessage: ChatMessage = {
      id: generateId(),
      senderId: userInfo.id,
      senderFirstName: userInfo.name,
      senderLastName: '',
      text: inputValue.trim(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, chatMessage]);
    broadcastData({ type: "chat_message", message: chatMessage });
    setInputValue("");
  }, [inputValue, userInfo, generateId, broadcastData]);

  const handleClearCanvas = useCallback(() => {
    // This function was unused, now it can be triggered by a button.
    if (window.confirm("Are you sure you want to clear the entire canvas? This cannot be undone.")) {
      setShapes([]);
      broadcastData({ type: 'clear_canvas' });
      persistShapes([]);
    }
  }, [broadcastData, persistShapes]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    shapes.forEach(shape => {
      ctx.save();
      const { x: shapeCenterX, y: shapeCenterY } = getShapeCenter(shape);
      ctx.translate(shapeCenterX + (shape.offsetX || 0), shapeCenterY + (shape.offsetY || 0));
      ctx.rotate(shape.rotation || 0);
      ctx.scale(shape.scale || 1, shape.scale || 1);
      ctx.translate(-shapeCenterX, -shapeCenterY);

      if (shape.id === selectedShapeId) {
        ctx.strokeStyle = '#3b82f6'; 
        ctx.lineWidth = 2 / (shape.scale || 1);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(shape.x, shape.y, (shape as any).width, (shape as any).height); // Example for rect
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = shape.color || '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';


      switch (shape.type) {
        case 'rectangle': ctx.strokeRect(shape.x, shape.y, shape.width, shape.height); break;
        case 'circle': ctx.beginPath(); ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI); ctx.stroke(); break;
        case 'line': ctx.beginPath(); ctx.moveTo(shape.x, shape.y); ctx.lineTo(shape.x2, shape.y2); ctx.stroke(); break;
        case 'pencil':
          if (shape.points && shape.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            shape.points.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.stroke();
          }
          break;
        case 'text':
          ctx.fillStyle = shape.color || '#FFFFFF';
          ctx.font = `${shape.fontSize || 24}px ${shape.fontFamily || 'Inter'}`;
          ctx.fillText(shape.text, shape.x, shape.y);
          break;
      }
      ctx.restore();
    });
  }, [shapes, selectedShapeId, canvasDimensions]);


  if (isPageLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-white">Loading Room...</div>;
  }

  const ToolButton = ({ tool, label, children }: { tool: Tool, label: string, children: React.ReactNode }) => (
    <button
      title={label}
      onClick={() => setSelectedTool(tool)}
      className={`p-2 rounded-lg transition-colors duration-200 ${selectedTool === tool ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
    >
      {children}
    </button>
  );

  return (
    // --- The JSX part has one addition for the 'Clear Canvas' button ---
    <div className="relative min-h-screen bg-black font-inter flex text-white">
      {!isSidebarToggled && (
        <button
          onClick={() => setIsSidebarToggled(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
          aria-label="Open Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
        </button>
      )}

      <Sidebar
        onBackdropClick={() => setIsSidebarToggled(false)}
        toggled={isSidebarToggled}
        breakPoint="all"
        backgroundColor="#030712"
        width="300px"
        rootStyles={{ position: "fixed", height: "100%", borderRight: "1px solid #1f2937", zIndex: 60 }}
      >
        <Menu
          className="flex flex-col h-full"
          menuItemStyles={{
            button: { '&:hover': { backgroundColor: "#1f2937", color: "#fff" }, borderRadius: "8px", margin: "4px 12px", transition: "all 0.2s ease-in-out" },
          }}
        >
          <div className="flex-shrink-0 border-b border-gray-800 p-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">DrawHub</h2>
              <button onClick={() => setIsSidebarToggled(false)} className="p-1 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors" aria-label="Close Sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-shrink-0 mt-4 space-y-2">
            <MenuItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} className="text-gray-200 font-medium">
              {userInfo ? `You: ${userInfo.name}` : "Connecting..."}
            </MenuItem>
            <MenuItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} className="text-gray-300" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </MenuItem>
          </div>

          <div className="flex-grow overflow-y-auto mt-4 pt-4 border-t border-gray-800">
            <SubMenu label="Online Users" defaultOpen icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 003 16" /></svg>} className="text-gray-300">
              {onlineUsers.length > 1 ? (
                onlineUsers.map((user, index) => (
                  <MenuItem key={`${user.id}-${index}`} className="text-gray-400 text-sm">
                    {user.name} {user.id === userInfo?.id ? "(You)" : ""}
                  </MenuItem>
                ))
              ) : (
                <MenuItem key="no-users" className="text-gray-500 text-sm italic">Only you</MenuItem>
              )}
            </SubMenu>
          </div>

          <div className="flex-shrink-0 p-3 border-t border-gray-800 flex flex-col h-2/5 overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 px-2">Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-3 p-2 rounded-lg bg-gray-900 border border-gray-700 mb-2">
              {messages.map((message) => {
                const isOwnMessage = userInfo?.id === message.senderId;
                return (
                  <div key={message.id} className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
                    {!isOwnMessage && <p className="text-xs text-gray-400 px-1 font-bold">{message.senderFirstName}</p>}
                    <div className={`py-2 px-3 mt-1 rounded-2xl break-words text-sm max-w-xs ${isOwnMessage ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-700 text-white rounded-bl-none"}`}>
                      {message.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form className="flex items-center gap-2" onSubmit={handleSendMessage}>
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Type a message..." className="flex-grow rounded-md p-2 bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded-md shadow-md transition-colors duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </Menu>
      </Sidebar>

      <main className={`flex-1 flex flex-col items-center justify-center p-5 transition-all duration-300 ${isSidebarToggled ? "ml-[300px]" : ""}`}>
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 p-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl shadow-lg">
            <ToolButton tool="pencil" label="Pencil">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
            </ToolButton>
            <ToolButton tool="line" label="Line">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" transform="rotate(45 12 12)" /></svg>
            </ToolButton>
            <ToolButton tool="rectangle" label="Rectangle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></svg>
            </ToolButton>
            <ToolButton tool="circle" label="Circle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 110-18 9 9 0 010 18z" /></svg>
            </ToolButton>
            <ToolButton tool="text" label="Text">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5h16v2M12 5v14m-4-4h8" /></svg>
            </ToolButton>
            <div className="w-px h-6 bg-gray-700 mx-1"></div>
            <ToolButton tool="eraser" label="Eraser">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6" /></svg>
            </ToolButton>
            {/* FIX: Added a button to use the handleClearCanvas function */}
            <button
              title="Clear Canvas"
              onClick={handleClearCanvas}
              className="p-2 rounded-lg transition-colors duration-200 bg-red-800 text-gray-300 hover:bg-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
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
            className="rounded-lg shadow-2xl border-2 border-gray-800"
            style={{ touchAction: "none", cursor: "crosshair" }}
          />
        </div>

        {isTyping && textInputPosition && (
          <input
            type="text"
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onBlur={handleTextInputBlur}
            autoFocus
            style={{ position: "absolute", left: textInputPosition.x, top: textInputPosition.y, zIndex: 30 }}
            className="focus:outline-none p-2 rounded bg-gray-900 border border-blue-500 text-white text-lg"
          />
        )}
      </main>
    </div>
  );
}