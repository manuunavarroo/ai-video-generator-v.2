// File: app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const RUN_URL = process.env.RUNNINGHUB_RUN_URL!;
const API_KEY = process.env.RUNNINGHUB_API_KEY!;
const WEBAPP_ID = process.env.RUNNINGHUB_WEBAPP_ID!;

const getDimensions = (ratio: string) => {
  if (ratio === '9:16') return { width: 904, height: 1600 };
  if (ratio === '1:1') return { width: 1080, height: 1080 };
  if (ratio === '16:9') return { width: 1600, height: 904 };
  return { width: 1080, height: 1080 };
};

export async function POST(request: Request) {
  try {
    console.log("--- GENERATE FUNCTION STARTED ---");

    const { prompt, ratio } = await request.json();
    
    // --- DEBUG LOGS START ---
    console.log("Received prompt:", prompt);
    console.log("Received ratio:", ratio);
    
    const dimensions = getDimensions(ratio);
    console.log("Calculated dimensions object:", dimensions);
    // --- DEBUG LOGS END ---

    const { width, height } = dimensions;

    const payload = {
      webappId: WEBAPP_ID,
      apiKey: API_KEY,
      webhookUrl: `https://${process.env.VERCEL_URL}/api/webhook`,
      nodeInfoList: [
        { nodeId: '6', fieldName: 'text', fieldValue: prompt },
        { nodeId: '169', fieldName: 'width', fieldValue: width.toString() },
        { nodeId: '169', fieldName: 'height', fieldValue: height.toString() },
      ],
    };

    const response = await fetch(RUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.code !== 0) throw new Error(`API Error: ${result.msg}`);

    const taskId = result.data.taskId;
    const taskData = { taskId, prompt, ratio, width, height, status: 'processing', createdAt: new Date() };
    await redis.set(taskId, JSON.stringify(taskData));

    return NextResponse.json({ success: true, taskId });
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error("--- ERROR CAUGHT IN GENERATE FUNCTION ---", errorMessage);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}