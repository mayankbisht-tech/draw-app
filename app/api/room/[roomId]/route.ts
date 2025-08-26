import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { Prisma } from '@prisma/client';

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
type Shape = PencilShape | RectangleShape | CircleShape | LineShape | TextShape;
interface RoomPostBody {
    shapes: Shape[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;

    const { shapes } = await request.json() as RoomPostBody;

    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
        await tx.shape.deleteMany({
            where: { roomId }
        });

        if (shapes && Array.isArray(shapes) && shapes.length > 0) {
            await tx.shape.createMany({
                data: shapes.map((shape) => ({
                    type: shape.type,
                    props: shape as unknown as Prisma.JsonObject,
                    roomId: roomId
                }))
            });
        }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Failed to persist shapes:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;

    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const shapesFromDb = await prisma.shape.findMany({
      where: { roomId },
      orderBy: { id: 'asc' }
    });

    const reconstructedShapes = shapesFromDb.map(dbShape => {
        const props = dbShape.props as Prisma.JsonObject;
        return {
            ...props, 
            type: dbShape.type,
        };
    });

    return NextResponse.json({ shapes: reconstructedShapes }, { status: 200 });

  } catch (error) {
    console.error('Failed to fetch shapes:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}