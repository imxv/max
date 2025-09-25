'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

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
  previewTaskId?: string; // For refinement
  stage?: 'preview' | 'refined';
  taskType?: 'text-to-3d' | 'image-to-3d'; // Track task type for API calls
}

export default function ModelGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [modelUrl, setModelUrl] = useState<string>('');
  const [modelHistory, setModelHistory] = useState<GeneratedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeneratedModel | null>(null);

  // New refinement-related state
  const [generationStage, setGenerationStage] = useState<'preview' | 'refine'>('preview');
  const [texturePrompt, setTexturePrompt] = useState('');
  const [enablePbr, setEnablePbr] = useState(true);

  // Image upload state
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [refineImage, setRefineImage] = useState<string>('');
  const [refineImageFile, setRefineImageFile] = useState<File | null>(null);

  // Generation method state
  const [generationMethod, setGenerationMethod] = useState<'text' | 'image'>('text');

  // Auto-switch to preview mode if refinement is selected but no valid preview model
  useEffect(() => {
    if (generationStage === 'refine' && !selectedModel?.previewTaskId) {
      setGenerationStage('preview');
    }
  }, [generationStage, selectedModel]);

  // Convert image to base64
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  // Handle image upload for preview
  const handlePreviewImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await convertImageToBase64(file);
        setPreviewImageFile(file);
        setPreviewImage(base64);
      } catch (error) {
        console.error('Error converting image to base64:', error);
      }
    }
  };

  // Handle image upload for refinement
  const handleRefineImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await convertImageToBase64(file);
        setRefineImageFile(file);
        setRefineImage(base64);
      } catch (error) {
        console.error('Error converting image to base64:', error);
      }
    }
  };

  // Remove uploaded image
  const removePreviewImage = () => {
    setPreviewImage('');
    setPreviewImageFile(null);
  };

  const removeRefineImage = () => {
    setRefineImage('');
    setRefineImageFile(null);
  };

  const pollTaskStatus = async (taskId: string, taskType: 'text-to-3d' | 'image-to-3d' = 'text-to-3d'): Promise<TaskStatus> => {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 20; // Maximum 20 retries (about 1 minute)

      const poll = async () => {
        try {
          console.log('Polling status for task:', taskId, 'type:', taskType);
          const response = await fetch(`/api/generate?taskId=${taskId}&taskType=${taskType}`);

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
    if (generationStage === 'preview' && generationMethod === 'text' && !prompt.trim()) return;
    if (generationStage === 'preview' && generationMethod === 'image' && !previewImage) return;
    if (generationStage === 'refine' && !selectedModel?.previewTaskId) return;

    setIsGenerating(true);
    setModelUrl('');

    try {
      if (generationStage === 'preview') {
        // Step 1: Create preview
        setCurrentStage('Creating preview...');

        const requestBody: {
          prompt?: string;
          mode: string;
          image_url?: string;
          enablePbr?: boolean;
        } = {
          mode: 'preview'
        };

        // Determine task type and set parameters
        const currentTaskType: 'text-to-3d' | 'image-to-3d' = generationMethod === 'image' ? 'image-to-3d' : 'text-to-3d';

        // Add prompt or image based on generation method
        if (generationMethod === 'image' && previewImage) {
          requestBody.image_url = previewImage;
          // For preview stage with image upload, we want white model (no texture)
          // Don't send enablePbr since should_texture will be false on backend
        } else if (generationMethod === 'text' && prompt.trim()) {
          requestBody.prompt = prompt;
        }

        const previewResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
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

        // Poll preview status with correct task type
        const completedPreview = await pollTaskStatus(taskId, currentTaskType);

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
              prompt: generationMethod === 'image' ? 'Generated from uploaded image' : prompt,
              modelUrl: modelUrl,
              createdAt: new Date(),
              thumbnailUrl: completedPreview.thumbnail_url || completedPreview.result?.thumbnail_url,
              previewTaskId: taskId,
              stage: 'preview',
              taskType: currentTaskType
            };
            setModelHistory(prev => [newModel, ...prev]);
            setSelectedModel(newModel);

            // Clear input after successful preview generation
            if (generationMethod === 'text') {
              setPrompt('');
            } else {
              setPreviewImage('');
              setPreviewImageFile(null);
            }
          }
        }

      } else if (generationStage === 'refine') {
        // Refinement mode
        setCurrentStage('Creating refinement task...');

        const requestBody: {
          mode: string;
          previewTaskId: string;
          enablePbr: boolean;
          texturePrompt?: string;
          image_url?: string;
        } = {
          mode: 'refine',
          previewTaskId: selectedModel?.previewTaskId || '',
          enablePbr: enablePbr
        };

        if (texturePrompt.trim()) {
          requestBody.texturePrompt = texturePrompt.trim();
        }

        if (refineImage) {
          requestBody.image_url = refineImage;
        }

        const refineResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!refineResponse.ok) {
          throw new Error('Failed to create refinement task');
        }

        const refineData = await refineResponse.json();
        console.log('Refinement API response:', refineData);
        setCurrentStage('Generating refined model with textures...');

        // Check different possible field names for task ID
        const refineTaskId = refineData.result || refineData.id || refineData.task_id || refineData.taskId;

        if (!refineTaskId) {
          console.error('No refinement task ID found in response:', refineData);
          throw new Error(`No task ID returned from refinement API. Response: ${JSON.stringify(refineData)}`);
        }

        // Poll refinement status (refinement is always text-to-3d)
        const completedRefinement = await pollTaskStatus(refineTaskId, 'text-to-3d');

        if (completedRefinement.status === 'FAILED') {
          throw new Error('Refinement generation failed');
        }

        // Use refined model
        if (completedRefinement.status === 'SUCCEEDED') {
          const modelUrl = completedRefinement.model_urls?.glb || completedRefinement.result?.model_urls?.glb;
          if (modelUrl) {
            setModelUrl(modelUrl);
            setCurrentStage('Refined model ready!');

            // Add refined model to history
            const refinedModel: GeneratedModel = {
              id: refineTaskId,
              prompt: `${selectedModel?.prompt || ''}${texturePrompt ? ` (${texturePrompt})` : ''}`,
              modelUrl: modelUrl,
              createdAt: new Date(),
              thumbnailUrl: completedRefinement.thumbnail_url || completedRefinement.result?.thumbnail_url,
              previewTaskId: selectedModel?.previewTaskId || '',
              stage: 'refined',
              taskType: 'text-to-3d' // Refinement is always text-to-3d
            };
            setModelHistory(prev => [refinedModel, ...prev]);
            setSelectedModel(refinedModel);
          }
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
            {/* Stage Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Generation Stage:
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGenerationStage('preview')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    generationStage === 'preview'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                  disabled={isGenerating}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationStage('refine')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    generationStage === 'refine'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                  disabled={isGenerating || !selectedModel?.previewTaskId}
                >
                  Refinement
                </button>
              </div>
              {generationStage === 'refine' && !selectedModel?.previewTaskId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Select a preview model to enable refinement
                </p>
              )}
            </div>

            {/* Preview Mode Fields */}
            {generationStage === 'preview' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Generation Method:
                  </label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setGenerationMethod('text');
                        setPreviewImage('');
                        setPreviewImageFile(null);
                      }}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        generationMethod === 'text'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      disabled={isGenerating}
                    >
                      Text Prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenerationMethod('image');
                        setPrompt('');
                      }}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        generationMethod === 'image'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                      disabled={isGenerating}
                    >
                      Image Upload
                    </button>
                  </div>
                </div>

                {generationMethod === 'text' && (
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
                )}

                {generationMethod === 'image' && previewImage && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Uploaded Image:
                    </label>
                    <div className="space-y-2">
                      <div className="relative w-full h-48 border-2 border-dashed border-border rounded-lg overflow-hidden">
                        <Image
                          src={previewImage}
                          alt="Preview upload"
                          fill
                          className="object-contain"
                        />
                        <button
                          type="button"
                          onClick={removePreviewImage}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-destructive/90"
                          disabled={isGenerating}
                        >
                          ×
                        </button>
                      </div>
                      {previewImageFile && (
                        <p className="text-xs text-muted-foreground">
                          {previewImageFile.name} ({(previewImageFile.size / 1024 / 1024).toFixed(1)} MB)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {generationMethod === 'image' && !previewImage && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Upload an image to convert to 3D:
                    </label>
                    <>
                      <SignedIn>
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePreviewImageUpload}
                            className="hidden"
                            id="preview-image-upload"
                            disabled={isGenerating}
                          />
                          <label
                            htmlFor="preview-image-upload"
                            className="cursor-pointer flex flex-col items-center space-y-3"
                          >
                            <div className="text-4xl">📸</div>
                            <p className="text-sm font-medium text-foreground">
                              Click to upload an image
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PNG, JPG, JPEG (Max 10MB)
                            </p>
                          </label>
                        </div>
                      </SignedIn>
                      <SignedOut>
                        <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center bg-muted/20">
                          <SignInButton mode="modal">
                            <button className="flex flex-col items-center space-y-3 text-muted-foreground hover:text-foreground transition-colors">
                              <div className="text-4xl">🔒</div>
                              <p className="text-sm font-medium">
                                Sign in to upload images
                              </p>
                              <p className="text-xs">
                                Click here to sign in and start creating
                              </p>
                            </button>
                          </SignInButton>
                        </div>
                      </SignedOut>
                    </>
                  </div>
                )}
              </div>
            )}

            {/* Refinement Mode Fields */}
            {generationStage === 'refine' && selectedModel?.previewTaskId && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Selected Preview Model:
                  </label>
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedModel.prompt}
                  </div>
                </div>

                <div>
                  <label htmlFor="texturePrompt" className="block text-sm font-medium text-foreground mb-2">
                    Texture Description (Optional):
                  </label>
                  <Textarea
                    id="texturePrompt"
                    value={texturePrompt}
                    onChange={(e) => setTexturePrompt(e.target.value)}
                    placeholder="e.g., Metallic surface, Wood grain, Glossy paint..."
                    className="resize-none"
                    rows={3}
                    maxLength={300}
                    disabled={isGenerating}
                  />
                  <div className="text-sm text-muted-foreground mt-1">
                    {texturePrompt.length}/300 characters
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Reference Image (Optional):
                  </label>
                  {!refineImage ? (
                    <>
                      <SignedIn>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleRefineImageUpload}
                            className="hidden"
                            id="refine-image-upload"
                            disabled={isGenerating}
                          />
                          <label
                            htmlFor="refine-image-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <div className="text-2xl">🎨</div>
                            <p className="text-sm text-muted-foreground">
                              Upload reference image for texture
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PNG, JPG, JPEG (Max 10MB)
                            </p>
                          </label>
                        </div>
                      </SignedIn>
                      <SignedOut>
                        <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center bg-muted/20">
                          <SignInButton mode="modal">
                            <button className="flex flex-col items-center space-y-2 text-muted-foreground hover:text-foreground transition-colors">
                              <div className="text-2xl">🔒</div>
                              <p className="text-sm">
                                Sign in to upload reference images
                              </p>
                              <p className="text-xs">
                                Click here to sign in
                              </p>
                            </button>
                          </SignInButton>
                        </div>
                      </SignedOut>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative w-full h-32 border-2 border-dashed border-border rounded-lg overflow-hidden">
                        <Image
                          src={refineImage}
                          alt="Refine reference"
                          fill
                          className="object-contain"
                        />
                        <button
                          type="button"
                          onClick={removeRefineImage}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-destructive/90"
                          disabled={isGenerating}
                        >
                          ×
                        </button>
                      </div>
                      {refineImageFile && (
                        <p className="text-sm text-muted-foreground">
                          {refineImageFile.name} ({(refineImageFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enablePbr"
                    checked={enablePbr}
                    onChange={(e) => setEnablePbr(e.target.checked)}
                    disabled={isGenerating}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="enablePbr" className="text-sm text-foreground">
                    Enable PBR Maps (metallic, roughness, normal)
                  </label>
                </div>
              </div>
            )}

            <SignedIn>
              <Button
                onClick={generateModel}
                disabled={isGenerating ||
                  (generationStage === 'preview' && generationMethod === 'text' && !prompt.trim()) ||
                  (generationStage === 'preview' && generationMethod === 'image' && !previewImage) ||
                  (generationStage === 'refine' && !selectedModel?.previewTaskId)}
                className="w-full"
                size="lg"
              >
                <div className="flex items-center space-x-2">
                  {isGenerating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  )}
                  <span>
                    {isGenerating
                      ? (currentStage || 'Generating...')
                      : generationStage === 'preview'
                        ? 'Generate Preview Model'
                        : 'Generate Refined Model'
                    }
                  </span>
                </div>
              </Button>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button className="w-full" size="lg">
                  <div className="flex items-center space-x-2">
                    <span>🔒</span>
                    <span>Sign in to Generate Models</span>
                  </div>
                </Button>
              </SignInButton>
            </SignedOut>
          </div>
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
          <div className="h-full bg-background rounded-lg border border-border flex items-center justify-center relative">
            <ModelViewer modelUrl={selectedModel?.modelUrl || modelUrl} />

            {/* Instruction text - Positioned at bottom left-center */}
            {(selectedModel || modelUrl) && (
              <div className="absolute bottom-4 left-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap bg-background/90 backdrop-blur-sm px-3 py-1 rounded-md shadow-sm border border-border">
                  Use mouse to rotate, scroll to zoom, and drag to adjust the 3D model
                </p>
              </div>
            )}

            {/* Download Button - Positioned at bottom right */}
            {selectedModel && (
              <Button
                asChild
                variant="outline"
                className="absolute bottom-4 right-4 shadow-lg bg-background/90 backdrop-blur-sm hover:bg-background"
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
            )}
          </div>
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
                      <div className="w-12 h-12 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center relative">
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
                        {/* Stage badge */}
                        <div className={`absolute -top-1 -right-1 px-1 py-0.5 text-xs rounded-full text-white ${
                          model.stage === 'refined' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          {model.stage === 'refined' ? 'R' : 'P'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {model.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">
                            {model.createdAt.toLocaleString()}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            model.stage === 'refined'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {model.stage === 'refined' ? 'Refined' : 'Preview'}
                          </span>
                        </div>
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