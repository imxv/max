'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

// Dynamically import the ModelViewer component with no SSR
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-muted rounded-lg flex items-center justify-center">
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

interface GeneratedModel {
  id: string;
  prompt: string;
  modelUrl: string;
  createdAt: Date;
  thumbnailUrl?: string;
}

export default function ModelGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [modelUrl, setModelUrl] = useState<string>('');
  const [modelHistory, setModelHistory] = useState<GeneratedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeneratedModel | null>(null);

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

          // Add to history
          const newModel: GeneratedModel = {
            id: taskId,
            prompt: prompt,
            modelUrl: modelUrl,
            createdAt: new Date(),
            thumbnailUrl: completedPreview.thumbnail_url || completedPreview.result?.thumbnail_url
          };
          setModelHistory(prev => [newModel, ...prev]);
          setSelectedModel(newModel);
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
    <div className="flex w-full h-full">
      {/* Left Panel - Controls */}
      <div className="w-80 border-r border-border bg-background flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Model Generation
          </h2>

          <div className="space-y-4">
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
                    <span className="text-foreground text-sm">{currentStage}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStage && !isGenerating && (
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <span className="text-foreground text-sm">{currentStage}</span>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Model Controls */}
        <div className="p-4">
          <h3 className="text-md font-medium text-foreground mb-3">
            Model Controls
          </h3>
          {selectedModel && (
            <div className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full"
                size="sm"
              >
                <a
                  href={selectedModel.modelUrl.includes('meshy.ai') ?
                    `/api/proxy-model?url=${encodeURIComponent(selectedModel.modelUrl)}` :
                    selectedModel.modelUrl}
                  download="model.glb"
                >
                  Download GLB Model
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - 3D Viewer */}
      <div className="flex-1 flex flex-col bg-muted/20">
        <div className="p-4 border-b border-border bg-background">
          <h2 className="text-lg font-semibold text-foreground">
            3D Model Preview
          </h2>
          {selectedModel && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {selectedModel.prompt}
            </p>
          )}
        </div>

        <div className="flex-1 p-4">
          <div className="h-full bg-background rounded-lg border border-border flex items-center justify-center">
            <ModelViewer modelUrl={selectedModel?.modelUrl || modelUrl} />
          </div>

          {(selectedModel || modelUrl) && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground text-center">
                Use mouse to rotate and zoom the 3D model
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - History */}
      <div className="w-80 border-l border-border bg-background flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Generated Models
          </h2>
          <p className="text-sm text-muted-foreground">
            {modelHistory.length} model{modelHistory.length !== 1 ? 's' : ''}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {modelHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-sm">No models generated yet</p>
                <p className="text-xs mt-1">Start by creating your first 3D model</p>
              </div>
            ) : (
              modelHistory.map((model) => (
                <Card
                  key={model.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedModel?.id === model.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedModel(model);
                    setModelUrl(model.modelUrl);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                        {model.thumbnailUrl ? (
                          <Image
                            src={model.thumbnailUrl}
                            alt="Model thumbnail"
                            width={48}
                            height={48}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-xl">🎯</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {model.prompt}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {model.createdAt.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}