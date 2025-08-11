// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0; // Ensure fresh data on every request

// Updated type to reflect video generation task data
type HistoryTask = {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete' | 'failed';
  createdAt: string;
  videoUrl?: string; // Changed from imageUrl
  completedAt?: string;
};

export async function GET() {
  try {
    const keys = await redis.keys('*');
    if (keys.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all tasks from Redis
    const items = await redis.mget<HistoryTask[]>(...keys);

    // Filter out any null items that might occur
    const validItems = items.filter((item): item is HistoryTask => item !== null);

    // Sort items by creation date, newest first
    const sortedItems = validItems.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(sortedItems);

  } catch (error: unknown) { 
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}