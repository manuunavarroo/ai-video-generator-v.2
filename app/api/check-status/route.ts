// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const API_KEY = process.env.RUNNINGHUB_API_KEY!;
const CHECK_URL = 'https://www.runninghub.ai/task/openapi/outputs';

// A type for our task object
type Task = {
  taskId: string;
  // ... add other properties if needed for type safety
};

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    if (!taskId) return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });

    const response = await fetch(CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': 'www.runninghub.ai' },
      body: JSON.stringify({ apiKey: API_KEY, taskId: taskId }),
    });

    const result = await response.json();

    if (result.code === 0 && result.data && result.data.length > 0) {
      const imageUrl = result.data[0].fileUrl;
      if (imageUrl) {
        // Get the data as an object directly, NOT a string
        const taskData = await redis.get<Task>(taskId);

        // Check if taskData exists and remove the JSON.parse line
        if (taskData) {
          const updatedTaskData = { ...taskData, status: 'complete', imageUrl: imageUrl, completedAt: new Date() };
          await redis.set(taskId, JSON.stringify(updatedTaskData));
        }
      }
    }
    return NextResponse.json({ success: true, status: result.msg });
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) { errorMessage = error.message; }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}