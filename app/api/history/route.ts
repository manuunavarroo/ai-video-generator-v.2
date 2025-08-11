// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

// Updated type to include the input imageUrl
type HistoryTask = {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete' | 'failed';
  createdAt: string;
  imageUrl?: string; // The input image for display in history
  videoUrl?: string; // The output video
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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}