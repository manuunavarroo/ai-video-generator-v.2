// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;

// --- TYPE DEFINITIONS TO PREVENT 'any' ---

// Describes a single item in the API response's 'content' array
interface ApiContent {
  type: string;
  video_url?: string;
}

// Describes the entire response from the external API
interface ApiResponse {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  content?: ApiContent[];
  message?: string;
}

// Describes the task data stored in Redis
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

    const getResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    // **FIX 1: Use the ApiResponse type instead of implicit 'any'**
    const result: ApiResponse = await getResponse.json();

    if (getResponse.status !== 200) {
      console.error(`Failed to get task status for ${taskId}: ${result.message}`);
      return NextResponse.json({ success: false, message: 'Failed to fetch status' }, { status: 500 });
    }
    
    const status = result.status;

    if (status === 'succeeded' || status === 'failed') {
      const taskDataString = await redis.get<string>(taskId);
      if (!taskDataString) {
        return NextResponse.json({ success: true, status: 'Task not found in DB' });
      }
      
      const taskData: TaskData = JSON.parse(taskDataString);

      if (taskData.status !== 'processing') {
        return NextResponse.json({ success: true, status: taskData.status });
      }

      if (status === 'succeeded') {
        taskData.status = 'complete';
        
        // **FIX 2: The '.find()' method no longer needs 'any'**
        // TypeScript now knows that `result.content` is an array of `ApiContent` objects.
        const videoContent = result.content?.find(c => c.type === 'video');

        if (videoContent?.video_url) {
            taskData.videoUrl = videoContent.video_url;
        } else {
            console.error("Task succeeded but no video_url found for taskId:", taskId);
            taskData.status = 'failed';
        }
        
        taskData.completedAt = new Date().toISOString();

      } else {
        taskData.status = 'failed';
        taskData.completedAt = new Date().toISOString();
      }
      
      await redis.set(taskId, JSON.stringify(taskData));
    }
    
    return NextResponse.json({ success: true, status });

  } catch (error: unknown) {
    // This catch block is safe and does not use 'any'
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error("Error in check-status:", errorMessage);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
