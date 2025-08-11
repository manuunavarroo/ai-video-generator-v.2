// File: app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Get Seedance Pro credentials from environment variables
const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;
const MODEL_ID = process.env.SEEDANCE_MODEL_ID!;

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ message: 'Prompt is required' }, { status: 400 });
    }

    // This payload assumes a text-to-video model.
    // If your model requires an image, you would add it to the content array.
    const createPayload = {
      model: MODEL_ID,
      content: [
        { type: 'text', text: prompt },
        // { type: 'image_url', image_url: { url: "some_image_url" } }
      ]
    };

    const createResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(createPayload),
    });

    const result = await createResponse.json();

    if (createResponse.status !== 200) {
      throw new Error(`API Error: ${result.message || 'Failed to create task'}`);
    }

    const taskId = result.id;
    
    // Save initial task data to Redis
    const taskData = { 
      taskId, 
      prompt, 
      status: 'processing', 
      createdAt: new Date().toISOString() // Use ISO string for consistency
    };
    await redis.set(taskId, JSON.stringify(taskData));

    return NextResponse.json({ success: true, taskId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}