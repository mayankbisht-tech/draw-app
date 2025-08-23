import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '../../../packages/db/src'; 
import type { Shape as PrismaShape } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;

  try {
    const room = await prisma.room.findUnique({
      where: { roomId },
      include: { shapes: true },
    });

    if (!room) {
      return NextResponse.json({ shapes: [] });
    }

    const normalizedShapes = room.shapes.map((shape: PrismaShape) => ({
      id: shape.id,
      type: shape.type,
      ...(shape.props as Record<string, any>), 
    }));

    return NextResponse.json({ shapes: normalizedShapes });
  } catch (err) {
    console.error('Failed to get room data:', err);
    return NextResponse.json(
      { error: 'Server error while fetching room data' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const shapeData = await req.json();

  if (!shapeData || !shapeData.id || !shapeData.type) {
    return NextResponse.json(
      { message: "Invalid shape data. 'id' and 'type' are required." },
      { status: 400 }
    );
  }

  try {
    const room = await prisma.room.upsert({
      where: { roomId },
      update: {},
      create: { roomId },
      select: { id: true },
    });

    const { id: shapeId, type, ...props } = shapeData;

    await prisma.shape.upsert({
      where: { id: shapeId },
      update: { type, props }, 
      create: {
        id: shapeId,
        type,
        props,
        roomId: room.id,
      },
    });

    return NextResponse.json(shapeData);
  } catch (err) {
    console.error('Failed to save shape:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process shape.', details: errorMessage },
      { status: 500 }
    );
  }
}
