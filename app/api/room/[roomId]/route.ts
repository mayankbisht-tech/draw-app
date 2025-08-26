import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const body = await request.json();
    const shapes = body.shapes; 
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await prisma.shape.deleteMany({
      where: { roomId }
    });

    if (shapes && Array.isArray(shapes) && shapes.length > 0) {
      await prisma.shape.createMany({
        data: shapes.map((shape: any) => ({
          type: shape.type,
          props: shape.props || shape, 
          roomId: roomId
        }))
      });
    }

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

    const shapes = await prisma.shape.findMany({
      where: { roomId },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json({ shapes }, { status: 200 });

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