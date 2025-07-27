// File: app/api/webhook/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // The actual data is in a stringified `eventData` field
    const eventData = JSON.parse(payload.eventData);
    const taskId = payload.taskId;
    
    // Check if the task was successful and has data
    if (eventData.code === 0 && eventData.data && eventData.data.length > 0) {
      const imageUrl = eventData.data[0].fileUrl;

      if (imageUrl && taskId) {
        // Get the original task data from our database
        const taskDataString = await redis.get<string>(taskId);
        if (taskDataString) {
          const taskData = JSON.parse(taskDataString);
          // Update the task with the final image URL and status
          const updatedTaskData = {
            ...taskData,
            status: 'complete',
            imageUrl: imageUrl,
            completedAt: new Date(),
          };
          // Save the completed task back to our database
          await redis.set(taskId, JSON.stringify(updatedTaskData));
        }
      }
    }
    
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    let errorMessage = 'Error processing webhook';
    if (error instanceof Error) { errorMessage = error.message; }
    console.error("--- WEBHOOK ERROR ---", errorMessage);
    // Return a success response even on error to prevent RunningHub from retrying
    return NextResponse.json({ success: true, error: errorMessage }, { status: 200 });
  }
}