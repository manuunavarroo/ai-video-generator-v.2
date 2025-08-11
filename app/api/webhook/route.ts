// File: app/api/webhook/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // FIX: Use eventData directly, as it's already a parsed object.
    const eventData = payload.eventData; 
    const taskId = payload.taskId;
    
    // Check if the task was successful and has data
    if (eventData && eventData.code === 0 && eventData.data && eventData.data.length > 0) {
      // The video URL is in a different place in the webhook response
      const videoUrl = eventData.data[0].videoUrl;

      if (videoUrl && taskId) {
        // Get the original task data from our database
        const taskDataString = await redis.get<string>(taskId);
        if (taskDataString) {
          const taskData = JSON.parse(taskDataString);
          
          // Update the task with the final video URL and status
          const updatedTaskData = {
            ...taskData,
            status: 'complete',
            videoUrl: videoUrl, // <-- Changed from imageUrl to videoUrl
            completedAt: new Date(),
          };
          
          // Save the completed task back to our database
          await redis.set(taskId, JSON.stringify(updatedTaskData));
        }
      }
    } else {
        // Handle cases where the task failed
        const taskDataString = await redis.get<string>(taskId);
        if (taskDataString) {
            const taskData = JSON.parse(taskDataString);
            const updatedTaskData = {
                ...taskData,
                status: 'failed',
                completedAt: new Date(),
            };
            await redis.set(taskId, JSON.stringify(updatedTaskData));
        }
    }
    
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    let errorMessage = 'Error processing webhook';
    if (error instanceof Error) { errorMessage = error.message; }
    console.error("--- WEBHOOK ERROR ---", errorMessage);
    // Return a success response even on error to prevent the API from retrying
    return NextResponse.json({ success: true, error: errorMessage }, { status: 200 });
  }
}
