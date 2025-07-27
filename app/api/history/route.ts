// File: app/api/history/route.ts
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

type Task = {
  createdAt: string;
};

export async function GET() {
  try {
    const keys = await redis.keys('*-*');
    if (keys.length === 0) return NextResponse.json([]);

    const itemsAsStrings = await redis.mget<string[]>(...keys);
    const items = itemsAsStrings.map(item => JSON.parse(item));
    
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