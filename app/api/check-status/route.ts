// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Get Seedance Pro credentials from environment variables
const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;

// Define a type for our task data in Redis
type TaskData = {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete' | 'failed';
  createdAt: string;
  videoUrl?: string;
  completedAt?: string;
};

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    if (!taskId) {
      return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
    }

    const getResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    const result = await getResponse.json();

    if (getResponse.status !== 200) {
      // If the API call fails, we don't know the status, so we just exit.
      // The next poll attempt will try again.
      console.error(`Failed to get task status for ${taskId}: ${result.message}`);
      return NextResponse.json({ success: false, message: 'Failed to fetch status' }, { status: 500 });
    }
    
    const status = result.status;

    // If the task has succeeded or failed, update its status in Redis
    if (status === 'succeeded' || status === 'failed') {
      const taskDataString = await redis.get<string>(taskId);
      if (!taskDataString) return NextResponse.json({ success: true, status: 'Task not found in DB' });
      
      const taskData: TaskData = JSON.parse(taskDataString);

      // Avoid updating already completed tasks
      if(taskData.status !== 'processing') {
        return NextResponse.json({ success: true, status: taskData.status });
      }

      if (status === 'succeeded') {
        taskData.status = 'complete';
        taskData.videoUrl = result.content.video_url; // Get the video URL
        taskData.completedAt = new Date().toISOString();
      } else { // status === 'failed'
        taskData.status = 'failed';
        taskData.completedAt = new Date().toISOString();
      }
      
      await redis.set(taskId, JSON.stringify(taskData));
    }
    
    return NextResponse.json({ success: true, status });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}