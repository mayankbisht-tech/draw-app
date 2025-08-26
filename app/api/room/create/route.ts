import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma'; 
export async function POST() {
  console.log("Attempting to create a new room...");
  try {
    const newRoom = await prisma.room.create({
      data: {},
    });

    console.log("Successfully created room:", newRoom.id);
    return NextResponse.json(newRoom, { status: 201 });

  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json({ 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
}
