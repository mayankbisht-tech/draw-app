export interface UserInfo {
  firstname: string;
  lastname?: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderFirstName: string;
  senderLastName: string; 
  text: string;
  timestamp: number;
}

// Base type for shared properties
interface BaseShape {
  id: string;
  color?: string;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scale?: number;
}

// Define specific properties for each shape type
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
  fontSize: number;
  fontFamily?: string;
}

// The final discriminated union
export type Shape = PencilShape | RectangleShape | CircleShape | LineShape | TextShape;