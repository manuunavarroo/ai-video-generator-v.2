// File: app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Readable } from 'stream';

const redis = Redis.fromEnv();

// Seedance Pro credentials
const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;
const MODEL_ID = process.env.SEEDANCE_MODEL_ID!;
// imgbb API key for temporary image hosting
const IMGBB_API_KEY = process.env.IMGBB_API_KEY!;

// Helper to convert a Web Stream to a Buffer
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File | null;

    if (!prompt || !imageFile) {
      return NextResponse.json({ message: 'Prompt and image are required' }, { status: 400 });
    }

    // --- Step 1: Upload the image to a public hosting service (imgbb) ---
    const imageBuffer = await streamToBuffer(imageFile.stream());
    const imageBase64 = imageBuffer.toString('base64');
    
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', imageBase64);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: imgbbFormData,
    });

    const imgbbResult = await imgbbResponse.json();
    if (!imgbbResult.success) {
      throw new Error(`Image upload failed: ${imgbbResult.error.message}`);
    }
    const publicImageUrl = imgbbResult.data.url;

    // --- Step 2: Create the video generation task with the public image URL ---
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
    
    // --- Step 3: Save task data to Redis, now including the input image URL ---
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