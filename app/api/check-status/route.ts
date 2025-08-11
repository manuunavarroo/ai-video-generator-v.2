// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;

// Interfaces to define the shape of our data
interface ApiContentObject {
  video_url?: string;
}
interface ApiResponse {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  content?: ApiContentObject;
  message?: string;
}
type TaskData = {
  taskId: string;
  prompt: string;
  imageUrl: string;
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

    // 1. Fetch the latest status from the video API
    const getResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    const result: ApiResponse = await getResponse.json();

    if (getResponse.status !== 200) {
      return NextResponse.json({ success: false, message: result.message || 'Failed to fetch status' }, { status: 500 });
    }
    
    const status = result.status;

    // 2. If the task is complete or failed, update our database
    if (status === 'succeeded' || status === 'failed') {
      const taskDataFromRedis = await redis.get(taskId);
      if (!taskDataFromRedis) return NextResponse.json({ success: true, status: 'Task not found in DB' });
      
      // ✅ FIX: Safely handle data that might already be an object
      let taskData: TaskData;
      if (typeof taskDataFromRedis === 'string') {
        taskData = JSON.parse(taskDataFromRedis); // Parse it only if it's a string
      } else {
        taskData = taskDataFromRedis as TaskData; // Otherwise, use it directly
      }

      // If already complete, do nothing.
      if (taskData.status !== 'processing') {
        return NextResponse.json({ success: true, status: taskData.status });
      }

      // Update the task with the final result
      if (status === 'succeeded') {
        taskData.status = 'complete';
        taskData.videoUrl = result.content?.video_url; // Get the video URL
      } else {
        taskData.status = 'failed';
      }
      taskData.completedAt = new Date().toISOString();
      
      // Save the final result back to Redis
      await redis.set(taskId, JSON.stringify(taskData));
    }
    
    return NextResponse.json({ success: true, status });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in check-status:", errorMessage);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
