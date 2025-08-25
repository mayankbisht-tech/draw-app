import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import type { Shape } from '../../../components/types/types';
import { Prisma } from '@prisma/client';

export async function GET(req: Request, { params }: { params: { roomId: string } }) {
    const { roomId } = params;

    try {
        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { shapes: true },
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        const transformedShapes = room.shapes.map(dbShape => {
            const props = dbShape.props as Prisma.JsonObject;
            return {
                id: dbShape.id,
                type: dbShape.type,
                ...props,
            };
        });

        return NextResponse.json({ shapes: transformedShapes });

    } catch (error) {
        console.error('Failed to fetch room data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
    const { roomId } = params;
    const { shapes }: { shapes: Shape[] } = await req.json();

    try {
        await prisma.$transaction([
            prisma.shape.deleteMany({
                where: { roomId: roomId },
            }),
            prisma.shape.createMany({
                data: shapes.map(shape => {
                    const { id, type, ...props } = shape;
                    return {
                        id,
                        type,
                        props: props as Prisma.JsonObject,
                        roomId: roomId,
                    };
                }),
            }),
        ]);

        const updatedRoom = await prisma.room.findUnique({
            where: { id: roomId },
            include: { shapes: true },
        });

        return NextResponse.json(updatedRoom);

    } catch (error) {
        console.error('Failed to update room:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
