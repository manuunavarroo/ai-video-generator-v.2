// File: app/api/check-status/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const API_KEY = process.env.RUNNINGHUB_API_KEY!;
// This is the new endpoint you found
const CHECK_URL = 'https://www.runninghub.ai/task/openapi/outputs';

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
    }

    // Call the RunningHub API to check for the output
    const response = await fetch(CHECK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.ai',
      },
      body: JSON.stringify({ apiKey: API_KEY, taskId: taskId }),
    });

    const result = await response.json();

    // If the API call was successful and returned image data...
    if (result.code === 0 && result.data && result.data.length > 0) {
      const imageUrl = result.data[0].fileUrl;

      if (imageUrl) {
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

    return NextResponse.json({ success: true, status: result.msg });

  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) { errorMessage = error.message; }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}