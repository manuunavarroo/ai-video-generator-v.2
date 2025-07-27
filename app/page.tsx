// File: app/page.tsx

'use client';
import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';

interface HistoryItem {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete';
  imageUrl?: string;
  createdAt: string;
  width?: number;
  height?: number;
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [ratio, setRatio] = useState<string>('1:1');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [useLora, setUseLora] = useState<boolean>(false);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [seedValue, setSeedValue] = useState<string>('');

  const fetchHistory = async () => {
    try {
      let historyResponse = await fetch('/api/history');
      if (!historyResponse.ok) return;
      
      let data: HistoryItem[] = await historyResponse.json();
      setHistory(data);

      const processingTasks = data.filter(item => item.status === 'processing');

      if (processingTasks.length > 0) {
        for (const task of processingTasks) {
          await fetch('/api/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.taskId }),
          });
        }
        
        historyResponse = await fetch('/api/history');
        if (historyResponse.ok) {
          data = await historyResponse.json();
          setHistory(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchHistory, 5000);
    fetchHistory();
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (seedMode === 'fixed' && !seedValue) {
      setMessage('❌ Please enter a seed value for Fixed mode.');
      return;
    }
    setLoading(true);
    setMessage('Sending request...');
    const finalSeed = seedMode === 'random' ? 'random' : seedValue;
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ratio, useLora, seed: finalSeed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'An error occurred');
      setMessage(`✅ Request sent! Your image will appear in the history below.`);
      setTimeout(fetchHistory, 1000);
    } catch (error: unknown) {
      let errorMessage = 'An error occurred';
      if (error instanceof Error) { errorMessage = error.message; }
      setMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const processingCount = history.filter(item => item.status === 'processing').length;
  const isQueueFull = processingCount >= 3;

  return (
    <main className="bg-slate-50 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h1 className="text-2xl font-bold mb-4 text-black">AI Image Generator</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-black" rows={3} required />
            </div>
            <div>
              <label htmlFor="ratio" className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
              <select id="ratio" value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-black">
                <option value="1:1">Square (1:1)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
              </select>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Advanced Options</h3>
              <div className="flex items-center justify-between">
                <label htmlFor="lora" className="text-sm font-medium text-gray-700">Add Skin Lora?</label>
                <button type="button" onClick={() => setUseLora(!useLora)} className={`${useLora ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full`}>
                  <span className={`${useLora ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}/>
                </button>
              </div>

              <div className="mt-4">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Seed</label>
                 <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input type="radio" name="seedMode" value="random" checked={seedMode === 'random'} onChange={() => setSeedMode('random')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"/>
                      <span className="ml-2 text-sm text-gray-700">Randomized</span>
                    </label>
                     <label className="flex items-center">
                      <input type="radio" name="seedMode" value="fixed" checked={seedMode === 'fixed'} onChange={() => setSeedMode('fixed')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"/>
                      <span className="ml-2 text-sm text-gray-700">Fixed</span>
                    </label>
                 </div>
                 {seedMode === 'fixed' && (
                  <input type="number" placeholder="Enter a seed number" value={seedValue} onChange={(e) => setSeedValue(e.target.value)} className="mt-2 w-full p-2 border border-gray-300 rounded-md" required/>
                 )}
              </div>
            </div>
            
            <button type="submit" disabled={loading || isQueueFull} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {loading ? 'Generating...' : 'Generate Image'}
            </button>
          </form>
          
          {isQueueFull && (
            <div className="mt-4 p-3 rounded-md text-sm bg-amber-100 text-amber-800 text-center">
              Queue is full (3 images processing). Please wait.
            </div>
          )}

          {message && <div className={`mt-4 p-3 rounded-md text-sm ${message.startsWith('❌') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</div>}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-black">History</h2>
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            {history.length > 0 ? history.map((item) => (
              <div key={item.taskId} className="border p-3 rounded-md bg-gray-50">
                <p className="font-semibold text-gray-800 break-words">{item.prompt}</p>
                <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                <div className="mt-2">
                  {item.status === 'complete' && item.imageUrl ? (
                    <Image 
                      src={item.imageUrl} 
                      alt={item.prompt} 
                      width={item.width || 1080} 
                      height={item.height || 1080} 
                      className="rounded-md w-full h-auto" 
                    />
                  ) : (
                    <div className="text-center p-4 bg-gray-200 rounded-md"><p className="text-sm text-gray-600">⌛ Processing...</p></div>
                  )}
                </div>
              </div>
            )) : <p className="text-gray-500">Your generated images will appear here.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}