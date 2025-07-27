// File: app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const eventData = JSON.parse(payload.eventData);
    const taskId = eventData?.taskId;
    const imageUrl = eventData?.data?.[0]?.fileUrl;

    if (!taskId || !imageUrl) return NextResponse.json({ message: 'Missing data' }, { status: 400 });

    const taskDataString = await redis.get<string>(taskId);
    if (!taskDataString) return NextResponse.json({ message: 'Task not found' }, { status: 404 });

    const taskData = JSON.parse(taskDataString);
    const updatedTaskData = { ...taskData, status: 'complete', imageUrl: imageUrl, completedAt: new Date() };
    await redis.set(taskId, JSON.stringify(updatedTaskData));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: 'Error processing webhook' }, { status: 500 });
  }
}