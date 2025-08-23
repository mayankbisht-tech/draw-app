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

export type Shape =
  | { id: string; type: "pencil"; points: { x: number; y: number }[];
      x: number; y: number; 
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      scale?: number;
    }
  | { id: string; type: "rectangle"; x: number; y: number; width: number; height: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      scale?: number;
    }
  | { id: string; type: "circle"; x: number; y: number; radius: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      scale?: number;
    }
  | { id: string; type: "line"; x: number; y: number; x2: number; y2: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      scale?: number;
    }
  | { id: string; type: "text"; x: number; y: number; text: string; fontSize: number; fontFamily?: string; color?: string;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
      scale?: number;
    };