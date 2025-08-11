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
  imageUrl: string; // Ensure imageUrl is part of the type
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
      console.error(`Failed to get task status for ${taskId}: ${result.message}`);
      return NextResponse.json({ success: false, message: 'Failed to fetch status' }, { status: 500 });
    }
    
    const status = result.status;

    // If the task has succeeded or failed, update its status in Redis
    if (status === 'succeeded' || status === 'failed') {
      const taskDataString = await redis.get<string>(taskId);
      if (!taskDataString) {
        // If task is not in our DB, we can't update it. This can happen if Redis clears.
        return NextResponse.json({ success: true, status: 'Task not found in DB' });
      }
      
      const taskData: TaskData = JSON.parse(taskDataString);

      // Avoid re-processing tasks that are already finished
      if(taskData.status !== 'processing') {
        return NextResponse.json({ success: true, status: taskData.status });
      }

      if (status === 'succeeded') {
        taskData.status = 'complete';
        
        // ** THE FIX IS HERE **
        // Find the video content in the response array
        const videoContent = Array.isArray(result.content) 
            ? result.content.find((c: any) => c.type === 'video') 
            : null;

        if (videoContent && videoContent.video_url) {
            taskData.videoUrl = videoContent.video_url; // Assign the correct URL
        } else {
            // If the video URL is somehow missing on success, mark as failed to avoid a broken state
            console.error("Task succeeded but no video_url found in response for taskId:", taskId);
            taskData.status = 'failed';
        }
        
        taskData.completedAt = new Date().toISOString();

      } else { // status === 'failed'
        taskData.status = 'failed';
        taskData.completedAt = new Date().toISOString();
      }
      
      await redis.set(taskId, JSON.stringify(taskData));
    }
    
    return NextResponse.json({ success: true, status });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error in check-status:", errorMessage);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
