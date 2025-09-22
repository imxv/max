'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the ModelViewer component with no SSR
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center text-gray-500">
        <div className="text-4xl mb-2">🔄</div>
        <p>Loading 3D viewer...</p>
      </div>
    </div>
  )
});

interface TaskStatus {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
  };
  thumbnail_url?: string;
  result?: {
    model_urls: {
      glb?: string;
      fbx?: string;
      obj?: string;
    };
    thumbnail_url?: string;
  };
}

export default function ModelGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [modelUrl, setModelUrl] = useState<string>('');

  const pollTaskStatus = async (taskId: string): Promise<TaskStatus> => {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 20; // Maximum 20 retries (about 1 minute)

      const poll = async () => {
        try {
          console.log('Polling status for task:', taskId);
          const response = await fetch(`/api/generate?taskId=${taskId}`);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log('Poll response:', data);

          if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
            resolve(data);
          } else if (retryCount < maxRetries) {
            console.log(`Task status: ${data.status}, polling again in 3 seconds...`);
            retryCount++;
            setTimeout(poll, 3000); // Poll every 3 seconds
          } else {
            reject(new Error('Polling timeout: Task did not complete within expected time'));
          }
        } catch (error) {
          console.error('Error polling status:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(poll, 5000); // Retry after 5 seconds
          } else {
            reject(error);
          }
        }
      };
      poll();
    });
  };

  const generateModel = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentStage('Creating preview...');
    setModelUrl('');

    try {
      // Step 1: Create preview
      const previewResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'preview' }),
      });

      if (!previewResponse.ok) {
        throw new Error('Failed to create preview task');
      }

      const previewData = await previewResponse.json();
      console.log('Preview API response:', previewData);
      setCurrentStage('Generating preview mesh...');

      // Check different possible field names for task ID
      const taskId = previewData.result || previewData.id || previewData.task_id || previewData.taskId;

      if (!taskId) {
        console.error('No task ID found in response:', previewData);
        throw new Error(`No task ID returned from preview API. Response: ${JSON.stringify(previewData)}`);
      }

      // Poll preview status
      const completedPreview = await pollTaskStatus(taskId);

      if (completedPreview.status === 'FAILED') {
        throw new Error('Preview generation failed');
      }

      // Use preview model directly
      if (completedPreview.status === 'SUCCEEDED') {
        const modelUrl = completedPreview.model_urls?.glb || completedPreview.result?.model_urls?.glb;
        if (modelUrl) {
          setModelUrl(modelUrl);
          setCurrentStage('Preview model ready!');
        }
      }

    } catch (error) {
      console.error('Generation error:', error);
      setCurrentStage('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Generate 3D Model</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Describe your 3D model:
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A red sports car, A medieval castle, A cute robot..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              maxLength={600}
              disabled={isGenerating}
            />
            <div className="text-sm text-gray-500 mt-1">
              {prompt.length}/600 characters
            </div>
          </div>

          <button
            onClick={generateModel}
            disabled={isGenerating || !prompt.trim()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate 3D Model'}
          </button>

          {isGenerating && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-blue-800">{currentStage}</span>
              </div>
            </div>
          )}

          {currentStage && !isGenerating && (
            <div className="bg-green-50 p-4 rounded-lg">
              <span className="text-green-800">{currentStage}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D Viewer Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">3D Model Preview</h2>

        <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
          <ModelViewer modelUrl={modelUrl} />
        </div>

        {modelUrl && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">
              Use mouse to rotate and zoom the 3D model
            </p>
            <a
              href={modelUrl.includes('meshy.ai') ? `/api/proxy-model?url=${encodeURIComponent(modelUrl)}` : modelUrl}
              download="model.glb"
              className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Download GLB Model
            </a>
          </div>
        )}
      </div>
    </div>
  );
}