// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

// Use a more complete type that matches our actual data
type HistoryTask = {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete';
  createdAt: string; // This is a string after JSON parsing
};

export async function GET() {
  try {
    const keys = await redis.keys('*');
    if (keys.length === 0) {
      return NextResponse.json([]);
    }

    const itemsAsStrings = await redis.mget<string[]>(...keys);

    const items = itemsAsStrings
      .filter((item): item is string => item !== null)
      .map(item => JSON.parse(item));

    // Use the new, more complete type for sorting
    const sortedItems = items.sort((a: HistoryTask, b: HistoryTask) => 
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