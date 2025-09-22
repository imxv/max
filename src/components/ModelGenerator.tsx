'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

// Dynamically import the ModelViewer component with no SSR
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
      <div className="text-center text-muted-foreground">
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
      <Card>
        <CardHeader>
          <CardTitle>Generate 3D Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-foreground mb-2">
              Describe your 3D model:
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A red sports car, A medieval castle, A cute robot..."
              className="resize-none"
              rows={4}
              maxLength={600}
              disabled={isGenerating}
            />
            <div className="text-sm text-muted-foreground mt-1">
              {prompt.length}/600 characters
            </div>
          </div>

          <Button
            onClick={generateModel}
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? 'Generating...' : 'Generate 3D Model'}
          </Button>

          {isGenerating && (
            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-foreground">{currentStage}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStage && !isGenerating && (
            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <span className="text-foreground">{currentStage}</span>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* 3D Viewer Section */}
      <Card>
        <CardHeader>
          <CardTitle>3D Model Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
            <ModelViewer modelUrl={modelUrl} />
          </div>

          {modelUrl && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Use mouse to rotate and zoom the 3D model
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <a
                  href={modelUrl.includes('meshy.ai') ? `/api/proxy-model?url=${encodeURIComponent(modelUrl)}` : modelUrl}
                  download="model.glb"
                >
                  Download GLB Model
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}