'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SimilarModel {
  id: string;
  prompt: string;
  modelUrl: string;
  thumbnailUrl?: string;
  serviceType: string;
  createdAt: string;
  userId: string;
  similarity: number;
  isOwnModel: boolean;
}

interface SimilarModelsDialogProps {
  searchPrompt: string;
  similarModels: SimilarModel[];
  exactMatch: boolean;
  onSelectModel: (model: SimilarModel) => void;
  onGenerateNew: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function SimilarModelsDialog({
  searchPrompt,
  similarModels,
  exactMatch,
  onSelectModel,
  onGenerateNew,
  onClose,
  isLoading = false,
}: SimilarModelsDialogProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const handleSelectModel = () => {
    const selectedModel = similarModels.find(model => model.id === selectedModelId);
    if (selectedModel) {
      onSelectModel(selectedModel);
    }
  };

  const formatSimilarity = (similarity: number) => {
    return Math.round(similarity * 100);
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.9) return 'text-green-600 dark:text-green-400';
    if (similarity >= 0.7) return 'text-blue-600 dark:text-blue-400';
    if (similarity >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {exactMatch ? '🎯 找到完全匹配的模型' : '🔍 找到相似的模型'}
              </h2>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>您的输入：</strong> &quot;{searchPrompt}&quot;</p>
                <p>找到 {similarModels.length} 个相似模型，可以直接使用，无需消耗积分</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Models List */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-3">
            {similarModels.map((model) => (
              <Card
                key={model.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedModelId === model.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedModelId(model.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center relative">
                      {model.thumbnailUrl ? (
                        <Image
                          src={model.thumbnailUrl}
                          alt="Model thumbnail"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-2xl">🎯</div>
                      )}
                      {/* Similarity badge */}
                      <div className={`absolute -top-1 -right-1 px-2 py-1 text-xs font-bold rounded-full bg-white dark:bg-gray-800 border ${getSimilarityColor(model.similarity)}`}>
                        {formatSimilarity(model.similarity)}%
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {model.prompt}
                        </p>
                        <div className="flex items-center space-x-2">
                          {model.isOwnModel && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full">
                              我的模型
                            </span>
                          )}
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 rounded-full">
                            {model.serviceType === 'image-generation' ? '图片转3D' : '文本转3D'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <p>创建时间: {new Date(model.createdAt).toLocaleString()}</p>
                        <p className={`font-medium ${getSimilarityColor(model.similarity)}`}>
                          相似度: {formatSimilarity(model.similarity)}%
                        </p>
                      </div>

                      {/* Highlight differences if not exact match */}
                      {model.similarity < 0.95 && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <p className="text-muted-foreground">
                            💡 相似但不完全相同，使用此模型可以节省生成时间和积分
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {selectedModelId === model.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center text-sm text-primary">
                        <span className="mr-2">✓</span>
                        已选择此模型
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              💡 选择相似模型可以立即获得结果，无需等待生成时间
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onGenerateNew}
                disabled={isLoading}
              >
                🔄 生成新模型
              </Button>
              <Button
                onClick={handleSelectModel}
                disabled={!selectedModelId || isLoading}
                className="relative"
              >
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  </div>
                )}
                <span className={isLoading ? 'opacity-0' : ''}>
                  ✨ 使用选中模型
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}