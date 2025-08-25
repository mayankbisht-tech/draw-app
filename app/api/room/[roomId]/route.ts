import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "../../../packages/db/src";
import type { Shape as PrismaShape, Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { shapes: true },
    });

    if (!room) {
      return NextResponse.json({ shapes: [] });
    }

    
    const normalizedShapes = room.shapes.map((shape: PrismaShape) => ({
  id: shape.id,
  type: shape.type,
  ...(typeof shape.props === "object" && shape.props !== null
    ? (shape.props as Record<string, unknown>)
    : {}),
}));

    return NextResponse.json({ shapes: normalizedShapes });
  } catch (err) {
    console.error("Failed to get room data:", err);
    return NextResponse.json(
      { error: "Server error while fetching room data" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const shapeData = (await req.json()) as {
    id: string;
    type: string;
    [key: string]: unknown;
  };

  if (!shapeData || !shapeData.id || !shapeData.type) {
    return NextResponse.json(
      { message: "Invalid shape data. 'id' and 'type' are required." },
      { status: 400 }
    );
  }

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      await prisma.room.create({
        data: { id: roomId, roomId: roomId },
      });
    }

    const { id: shapeId, type, ...props } = shapeData;

    await prisma.shape.upsert({
      where: { id: shapeId },
      update: {
        type,
        props: props as Prisma.InputJsonValue, 
      },
      create: {
        id: shapeId,
        type,
        props: props as Prisma.InputJsonValue, 
        roomId: roomId,
      },
    });

    return NextResponse.json(shapeData);
  } catch (err) {
    console.error("Failed to save shape:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process shape.", details: errorMessage },
      { status: 500 }
    );
  }
}
