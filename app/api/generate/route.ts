// File: app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { put } from '@vercel/blob'; // Import the 'put' function from Vercel Blob

const redis = Redis.fromEnv();

// Seedance Pro credentials
const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;
const MODEL_ID = process.env.SEEDANCE_MODEL_ID!;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File | null;

    if (!prompt || !imageFile) {
      return NextResponse.json({ message: 'Prompt and image are required' }, { status: 400 });
    }

    // --- Step 1: Upload the image to Vercel Blob ---
    // The 'put' function handles the upload and returns an object with the public URL.
    const blob = await put(imageFile.name, imageFile, {
      access: 'public', // This makes the file publicly accessible
    });

    const publicImageUrl = blob.url; // Get the public URL from the response

    // --- Step 2: Create the video generation task with the Vercel Blob URL ---
    const createPayload = {
      model: MODEL_ID,
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: publicImageUrl } }
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
    
    // --- Step 3: Save task data to Redis ---
    const taskData = { 
      taskId, 
      prompt, 
      imageUrl: publicImageUrl, // Save the public URL for history
      status: 'processing', 
      createdAt: new Date().toISOString()
    };
    await redis.set(taskId, JSON.stringify(taskData));

    return NextResponse.json({ success: true, taskId });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
