// File: app/api/history/route.ts
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
export const revalidate = 0;

export async function GET() {
  try {
    const keys = await redis.keys('*-*');
    if (keys.length === 0) return NextResponse.json([]);

    const itemsAsStrings = await redis.mget<string[]>(...keys);
    const items = itemsAsStrings.map(item => JSON.parse(item));
    const sortedItems = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(sortedItems);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}