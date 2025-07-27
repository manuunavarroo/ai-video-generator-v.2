// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

type HistoryTask = {
  createdAt: string;
};

export async function GET() {
  try {
    console.log("--- HISTORY FUNCTION STARTED ---");
    const keys = await redis.keys('*');
    if (keys.length === 0) {
      console.log("No keys found, returning empty array.");
      return NextResponse.json([]);
    }

    const itemsAsStrings = await redis.mget<string[]>(...keys);

    // --- THIS IS THE CRITICAL LOG ---
    console.log("Raw data from Redis before parsing:", itemsAsStrings);
    // -----------------------------

    const items = itemsAsStrings
      .filter((item): item is string => item !== null)
      .map(item => JSON.parse(item));

    const sortedItems = items.sort((a: HistoryTask, b: HistoryTask) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(sortedItems);
  } catch (error: unknown) {
    // This will log the exact parsing error. 
    console.error("--- ERROR IN HISTORY API ---", error);

    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}