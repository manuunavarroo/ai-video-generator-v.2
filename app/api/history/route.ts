// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

// This type should be complete to match the data
type HistoryTask = {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete';
  createdAt: string;
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
    console.error("--- ERROR IN HISTORY API ---", error);
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}