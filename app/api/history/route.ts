// File: app/api/history/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

// This type helps with sorting
type Task = {
  createdAt: string;
};

export async function GET() {
  try {
    // This pattern gets ALL keys, which is correct for our use case
    const keys = await redis.keys('*');
    if (keys.length === 0) {
      return NextResponse.json([]);
    }

    const itemsAsStrings = await redis.mget<string[]>(...keys);
    
    // Safely filter out any potential null items before parsing
    const items = itemsAsStrings
      .filter((item): item is string => item !== null)
      .map(item => JSON.parse(item));
    
    // The sorting logic is correct
    const sortedItems = items.sort((a: Task, b: Task) => 
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