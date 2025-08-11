// File: app/page.tsx

'use client';
import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Image from 'next/image';

interface HistoryItem {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete' | 'failed';
  videoUrl?: string;
  imageUrl?: string;
  createdAt: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      let historyResponse = await fetch('/api/history');
      if (!historyResponse.ok) return;
      let data: HistoryItem[] = await historyResponse.json();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); // Poll for history updates
    return () => clearInterval(interval);
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setMessage('❌ Please upload an image.');
      return;
    }
    setLoading(true);
    setMessage('Uploading image and sending request...');

    const finalPrompt = `${prompt} --resolution 1080p --duration 10`;
    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('image', imageFile);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'An error occurred');
      
      setMessage(`✅ Request sent! Your video will appear in the history below.`);
      setPrompt('');
      setImageFile(null);
      setImagePreview(null);
      // Explicitly call fetchHistory after a short delay
      setTimeout(fetchHistory, 1000); 
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const processingCount = history.filter(item => item.status === 'processing').length;
  const isQueueFull = processingCount >= 5;

  return (
    <main className="bg-slate-50 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h1 className="text-2xl font-bold mb-4 text-black">AI Video Generator</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-black" rows={3} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
              <input type="file" onChange={handleImageChange} accept="image/png, image/jpeg, image/webp" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required/>
            </div>
            {imagePreview && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Image Preview:</p>
                <Image src={imagePreview} alt="Image preview" width={200} height={200} className="rounded-lg object-cover w-full h-auto" />
              </div>
            )}
            <button type="submit" disabled={loading || isQueueFull} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {loading ? 'Generating...' : 'Generate Video'}
            </button>
          </form>
          {isQueueFull && <div className="mt-4 p-3 rounded-md text-sm bg-amber-100 text-amber-800 text-center">Queue is full. Please wait for current tasks to complete.</div>}
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
                  {item.status === 'complete' && item.videoUrl ? (
                    <div>
                      <p className="text-xs font-bold text-gray-600 mb-1">Output:</p>
                      <video controls muted autoPlay loop className="rounded-md w-full h-auto bg-black">
                        <source src={item.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ) : item.status === 'failed' ? (
                     <div className="text-center p-4 bg-red-100 rounded-md"><p className="text-sm text-red-700">❌ Generation Failed</p></div>
                  ) : (
                    <div className="text-center p-4 bg-gray-200 rounded-md"><p className="text-sm text-gray-600">⌛ Processing...</p></div>
                  )}
                </div>
              </div>
            )) : <p className="text-gray-500">Your generated videos will appear here.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
