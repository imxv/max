'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { ModelStatus } from '@prisma/client';

export interface GeneratedModel {
  id: string;
  userId: string;
  serviceType: string;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string | null;
  creditsCost: number;
  status: ModelStatus;
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UseModelsReturn {
  models: GeneratedModel[];
  loading: boolean;
  error: string | null;
  loadModels: () => Promise<void>;
  saveModel: (modelData: {
    taskId: string;
    serviceType: string;
    modelUrl?: string;
    thumbnailUrl?: string;
    prompt?: string;
    creditsCost: number;
    status?: ModelStatus;
  }) => Promise<GeneratedModel | null>;
  updateModelRating: (modelId: string, rating: number, comment?: string) => Promise<boolean>;
  deleteModel: (modelId: string) => Promise<boolean>;
  total: number;
}

export function useModels(): UseModelsReturn {
  const { user, isLoaded } = useUser();
  const [models, setModels] = useState<GeneratedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadModels = useCallback(async () => {
    // Don't load if user is not logged in
    if (!user) {
      setModels([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('请先登录');
        }
        throw new Error(`Failed to load models: ${response.status}`);
      }

      const data = await response.json();

      // Convert date strings to Date objects
      const modelsWithDates = data.models.map((model: GeneratedModel) => ({
        ...model,
        createdAt: new Date(model.createdAt),
        updatedAt: new Date(model.updatedAt),
      }));

      setModels(modelsWithDates);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      setError(errorMessage);
      console.error('Error loading models:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load models when user changes or component mounts
  useEffect(() => {
    if (isLoaded) {
      loadModels();
    }
  }, [loadModels, isLoaded, user]);

  const saveModel = useCallback(async (modelData: {
    taskId: string;
    serviceType: string;
    modelUrl?: string;
    thumbnailUrl?: string;
    prompt?: string;
    creditsCost: number;
    status?: ModelStatus;
  }): Promise<GeneratedModel | null> => {
    setError(null);

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modelData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('请先登录');
        }
        throw new Error(`Failed to save model: ${response.status}`);
      }

      const savedModel = await response.json();

      // Convert date strings to Date objects
      const modelWithDates = {
        ...savedModel,
        createdAt: new Date(savedModel.createdAt),
        updatedAt: new Date(savedModel.updatedAt),
      };

      // Update local state
      setModels(prevModels => {
        const existingIndex = prevModels.findIndex(m => m.id === modelWithDates.id);
        if (existingIndex >= 0) {
          // Update existing model
          const updatedModels = [...prevModels];
          updatedModels[existingIndex] = modelWithDates;
          return updatedModels;
        } else {
          // Add new model to the beginning
          return [modelWithDates, ...prevModels];
        }
      });

      return modelWithDates;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save model';
      setError(errorMessage);
      console.error('Error saving model:', err);
      return null;
    }
  }, []);

  const updateModelRating = useCallback(async (modelId: string, rating: number, comment?: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/rating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comment }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('请先登录');
        }
        if (response.status === 404) {
          throw new Error('模型不存在或已被删除');
        }
        throw new Error(`Failed to update rating: ${response.status}`);
      }

      // Update local state
      setModels(prevModels =>
        prevModels.map(model =>
          model.id === modelId
            ? { ...model, rating, updatedAt: new Date() }
            : model
        )
      );

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rating';
      setError(errorMessage);
      console.error('Error updating model rating:', err);
      return false;
    }
  }, []);

  const deleteModel = useCallback(async (modelId: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/models?id=${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('请先登录');
        }
        if (response.status === 404) {
          throw new Error('模型不存在或已被删除');
        }
        throw new Error(`Failed to delete model: ${response.status}`);
      }

      // Update local state
      setModels(prevModels => prevModels.filter(m => m.id !== modelId));
      setTotal(prevTotal => Math.max(0, prevTotal - 1));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete model';
      setError(errorMessage);
      console.error('Error deleting model:', err);
      return false;
    }
  }, []);

  return {
    models,
    loading,
    error,
    loadModels,
    saveModel,
    updateModelRating,
    deleteModel,
    total,
  };
}