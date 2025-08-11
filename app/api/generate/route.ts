// File: app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { put } from '@vercel/blob';

const redis = Redis.fromEnv();

// Seedance Pro credentials
const API_BASE_URL = process.env.SEEDANCE_API_BASE_URL!;
const API_KEY = process.env.SEEDANCE_API_KEY!;
const MODEL_ID = process.env.SEEDANCE_MODEL_ID!;

export async function POST(request: Request) {
  console.log("--- GENERATE API: ROUTE HIT ---"); // 1. Check if the function starts

  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File | null;

    console.log("--- GENERATE API: FormData Parsed ---"); // 2. Check if form data is parsed

    if (!prompt || !imageFile) {
      console.error("--- GENERATE API: ERROR - Missing prompt or imageFile ---");
      return NextResponse.json({ message: 'Prompt and image are required' }, { status: 400 });
    }

    console.log(`--- GENERATE API: Prompt: ${prompt.substring(0, 50)}... ---`);
    console.log(`--- GENERATE API: Image File Name: ${imageFile.name}, Size: ${imageFile.size} bytes ---`);

    // --- Step 1: Upload the image to Vercel Blob ---
    console.log("--- GENERATE API: STEP 1 - Uploading image to Vercel Blob... ---");
    const blob = await put(imageFile.name, imageFile, {
      access: 'public',
    });
    console.log("--- GENERATE API: STEP 1 - Vercel Blob upload successful ---");
    console.log(`--- GENERATE API: STEP 1 - Blob URL: ${blob.url} ---`);

    const publicImageUrl = blob.url;

    // --- Step 2: Create the video generation task ---
    const createPayload = {
      model: MODEL_ID,
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: publicImageUrl } }
      ]
    };

    console.log("--- GENERATE API: STEP 2 - Sending request to Seedance API... ---");
    const createResponse = await fetch(`${API_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(createPayload),
    });

    console.log(`--- GENERATE API: STEP 2 - Seedance API responded with status: ${createResponse.status} ---`);
    const result = await createResponse.json();

    if (createResponse.status !== 200) {
      // Log the actual error message from the external API
      console.error("--- GENERATE API: ERROR - Seedance API failed ---", result);
      throw new Error(`API Error: ${result.message || 'Failed to create task'}`);
    }

    const taskId = result.id;
    console.log(`--- GENERATE API: STEP 2 - Task created successfully. Task ID: ${taskId} ---`);

    // --- Step 3: Save task data to Redis ---
    const taskData = {
      taskId,
      prompt,
      imageUrl: publicImageUrl,
      status: 'processing',
      createdAt: new Date().toISOString()
    };

    console.log("--- GENERATE API: STEP 3 - Saving task data to Redis... ---");
    await redis.set(taskId, JSON.stringify(taskData));
    console.log("--- GENERATE API: STEP 3 - Task data saved to Redis successfully. ---");

    return NextResponse.json({ success: true, taskId });

  } catch (error: unknown) {
    console.error("--- GENERATE API: CATCH BLOCK - An error occurred ---");
    // Log the full error object for more detail
    console.error(error); 
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
