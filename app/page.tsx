// File: app/page.tsx
'use client';
import { useState, useEffect, FormEvent } from 'react';

interface HistoryItem {
  taskId: string;
  prompt: string;
  status: 'processing' | 'complete';
  imageUrl?: string;
  createdAt: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [ratio, setRatio] = useState<string>('1:1');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('Sending request...');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ratio }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'An error occurred');
      setMessage(`✅ Request sent! The image will appear in your history shortly.`);
      fetchHistory();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
    <main className="bg-slate-50 min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h1 className="text-2xl font-bold mb-4">AI Image Generator</h1>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" rows={3} required />
            </div>
            <div className="mb-4">
              <label htmlFor="ratio" className="block text-sm font-medium text-gray-700 mb-1">Aspect Ratio</label>
              <select id="ratio" value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                <option value="1:1">Square (1:1)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
              {loading ? 'Generating...' : 'Generate Image'}
            </button>
          </form>
          {message && <div className={`mt-4 p-3 rounded-md text-sm ${message.startsWith('❌') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</div>}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">History</h2>
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            {history.length > 0 ? history.map((item) => (
              <div key={item.taskId} className="border p-3 rounded-md bg-gray-50">
                <p className="font-semibold text-gray-800 break-words">{item.prompt}</p>
                <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                <div className="mt-2">
                  {item.status === 'complete' && item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.prompt} className="rounded-md w-full" />
                  ) : (
                    <div className="text-center p-4 bg-gray-200 rounded-md"><p className="text-sm text-gray-600">⌛ Processing...</p></div>
                  )}
                </div>
              </div>
            )) : <p className="text-gray-500">No images generated yet.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}