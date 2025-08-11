// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;

// --- TYPE DEFINITIONS (no changes here) ---
interface ApiContent {
  type: string;
  video_url?: string;
}
interface ApiResponse {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  content?: ApiContent[];
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
  console.log("\n--- CHECK-STATUS API: ROUTE HIT ---"); // 1. Check if the function starts

  try {
    const { taskId } = await request.json();
    if (!taskId) {
      console.error("--- CHECK-STATUS API: ERROR - Task ID is missing from request body ---");
      return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
    }

    console.log(`--- CHECK-STATUS API: Checking status for Task ID: ${taskId} ---`);

    // --- Step 1: Fetch status from Seedance API ---
    const getResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    console.log(`--- CHECK-STATUS API: Seedance API responded with status code: ${getResponse.status} ---`);

    // IMPORTANT DEBUGGING STEP: Get the raw text of the response
    const responseText = await getResponse.text();
    console.log(`--- CHECK-STATUS API: Raw API response text: ${responseText} ---`);

    // Now, try to parse the text as JSON
    const result: ApiResponse = JSON.parse(responseText);
    console.log(`--- CHECK-STATUS API: Parsed API response successfully ---`, result);

    if (getResponse.status !== 200) {
      console.error(`--- CHECK-STATUS API: ERROR - Failed to get task status for ${taskId}: ${result.message}`);
      return NextResponse.json({ success: false, message: 'Failed to fetch status' }, { status: 500 });
    }
    
    const status = result.status;
    console.log(`--- CHECK-STATUS API: Task status from API is: '${status}' ---`);

    // --- Step 2: Update database if the task is finished ---
    if (status === 'succeeded' || status === 'failed') {
      console.log(`--- CHECK-STATUS API: Task is finished. Updating Redis... ---`);
      
      const taskDataString = await redis.get<string>(taskId);
      if (!taskDataString) {
        console.warn(`--- CHECK-STATUS API: WARNING - Task ${taskId} found in API but not in Redis. ---`);
        return NextResponse.json({ success: true, status: 'Task not found in DB' });
      }
      
      const taskData: TaskData = JSON.parse(taskDataString);

      // Avoid re-processing a completed task
      if (taskData.status !== 'processing') {
        console.log(`--- CHECK-STATUS API: Task ${taskId} was already completed in Redis. Status: ${taskData.status}. Skipping update. ---`);
        return NextResponse.json({ success: true, status: taskData.status });
      }

      if (status === 'succeeded') {
        taskData.status = 'complete';
        const videoContent = result.content?.find(c => c.type === 'video');

        if (videoContent?.video_url) {
            taskData.videoUrl = videoContent.video_url;
            console.log(`--- CHECK-STATUS API: Found video URL: ${taskData.videoUrl} ---`);
        } else {
            console.error("--- CHECK-STATUS API: ERROR - Task succeeded but no video_url found for taskId:", taskId);
            taskData.status = 'failed';
        }
        taskData.completedAt = new Date().toISOString();

      } else { // status === 'failed'
        taskData.status = 'failed';
        taskData.completedAt = new Date().toISOString();
        console.log(`--- CHECK-STATUS API: Task failed. Marking as 'failed' in Redis. ---`);
      }
      
      await redis.set(taskId, JSON.stringify(taskData));
      console.log(`--- CHECK-STATUS API: Successfully updated Redis for task ${taskId}. ---`);
    }
    
    return NextResponse.json({ success: true, status });

  } catch (error: unknown) {
    console.error("--- CHECK-STATUS API: CATCH BLOCK - An error occurred ---");
    // Log the full error object for more detail
    console.error(error); 
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
