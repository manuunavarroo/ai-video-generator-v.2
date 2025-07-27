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
    const { prompt, ratio, useLora, seed } = await request.json();
    const { width, height } = getDimensions(ratio);

    // Start building the list of nodes to override
    const nodeInfoList = [
      { nodeId: '6', fieldName: 'text', fieldValue: prompt },
      { nodeId: '169', fieldName: 'width', fieldValue: width.toString() },
      { nodeId: '169', fieldName: 'height', fieldValue: height.toString() },
    ];

    // Add the "skin Lora" node based on the user's choice
    nodeInfoList.push({
      nodeId: '174',
      fieldName: 'strength_01',
      fieldValue: useLora ? "2.0" : "0",
    });

    // Add the seed node
    const finalSeed = (seed === 'random' || !seed) 
      ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
      : seed;
      
    nodeInfoList.push({
      nodeId: '164',
      fieldName: 'seed',
      fieldValue: finalSeed,
    });

    // Construct the payload with the correct webappId
    const payload = {
      webappId: WEBAPP_ID,
      apiKey: API_KEY,
      nodeInfoList: nodeInfoList,
      webhookUrl: `https://${process.env.VERCEL_URL}/api/webhook`,
    };

    const response = await fetch(RUN_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // The Host header is required by the documentation
        'Host': 'www.runninghub.ai'
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.code !== 0) throw new Error(`API Error: ${result.msg} - ${result.data?.promptTips}`);

    const taskId = result.data.taskId;
    const taskData = { taskId, prompt, ratio, width, height, status: 'processing', createdAt: new Date() };
    await redis.set(taskId, JSON.stringify(taskData));

    return NextResponse.json({ success: true, taskId });
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) { errorMessage = error.message; }
    console.error("--- ERROR CAUGHT IN GENERATE FUNCTION ---", errorMessage);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}