// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

// This is the fix. The type must include all possible fields.
type HistoryTask = {
  taskId: string;
  prompt: string;
  ratio: string;
  width: number;
  height: number;
  status: 'processing' | 'complete';
  createdAt: string;
  imageUrl?: string;
  completedAt?: string;
};

export async function GET() {
  try {
    const keys = await redis.keys('*');
    if (keys.length === 0) {
      return NextResponse.json([]);
    }

    const items = await redis.mget<HistoryTask[]>(...keys);

    const validItems = items.filter((item): item is HistoryTask => item !== null);

    const sortedItems = validItems.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(sortedItems);
  } catch (error: unknown) { 
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}