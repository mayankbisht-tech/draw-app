import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        interface DecodedToken {
            userId: string;
            userFirstName: string;
        }

        const decoded = jwt.verify(token, secret) as DecodedToken;

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, firstname: true, lastname: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            name: user.firstname,
            token: token,
        });

    } catch (error) {
        console.error('Token verification failed:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}
