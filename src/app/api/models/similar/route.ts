import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ModelStatus } from '@prisma/client';

// 简单的文本相似度计算函数
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const normalize = (text: string) => text.toLowerCase().trim();
  const normalizedText1 = normalize(text1);
  const normalizedText2 = normalize(text2);

  // 精确匹配
  if (normalizedText1 === normalizedText2) return 1.0;

  // 包含关系
  if (normalizedText1.includes(normalizedText2) || normalizedText2.includes(normalizedText1)) {
    return 0.8;
  }

  // 计算编辑距离 (Levenshtein distance)
  const calculateEditDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  };

  const distance = calculateEditDistance(normalizedText1, normalizedText2);
  const maxLength = Math.max(normalizedText1.length, normalizedText2.length);
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, similarity);
}

// 基于关键词的相似度计算
function calculateKeywordSimilarity(text1: string, text2: string): number {
  const extractKeywords = (text: string): Set<string> => {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0); // 改为长度 > 0，不过滤短词
    return new Set(words);
  };

  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { prompt, threshold = 0.3, limit = 5 } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 获取所有已完成的模型（包括用户自己的和其他用户的公开模型）
    const allModels = await prisma.generatedModel.findMany({
      where: {
        status: ModelStatus.COMPLETED,
        modelUrl: { not: null },
        prompt: { not: null },
        OR: [
          { userId: userId }, // 用户自己的模型
          // 未来可以添加公开模型的条件
        ]
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 计算相似度并筛选
    const similarModels = allModels
      .map(model => {
        const textSimilarity = calculateSimilarity(prompt, model.prompt || '');
        const keywordSimilarity = calculateKeywordSimilarity(prompt, model.prompt || '');

        // 对于短文本，更多依赖精确匹配
        let combinedSimilarity;
        if (prompt.trim().length <= 3) {
          // 短文本：精确匹配权重更高
          combinedSimilarity = textSimilarity * 0.9 + keywordSimilarity * 0.1;
        } else {
          // 长文本：综合相似度：文本相似度权重 0.7，关键词相似度权重 0.3
          combinedSimilarity = textSimilarity * 0.7 + keywordSimilarity * 0.3;
        }

        return {
          ...model,
          similarity: combinedSimilarity,
          textSimilarity,
          keywordSimilarity,
        };
      })
      .filter(model => model.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // 检查是否有精确匹配
    const exactMatch = similarModels.some(model => model.similarity >= 0.95);

    return NextResponse.json({
      similarModels: similarModels.map(model => ({
        id: model.id,
        prompt: model.prompt,
        modelUrl: model.modelUrl,
        thumbnailUrl: model.thumbnailUrl,
        serviceType: model.serviceType,
        createdAt: model.createdAt,
        userId: model.userId,
        similarity: model.similarity,
        isOwnModel: model.userId === userId,
      })),
      exactMatch,
      searchPrompt: prompt,
      threshold,
      totalChecked: allModels.length,
    });

  } catch (error) {
    console.error('Error searching similar models:', error);
    return NextResponse.json(
      { error: 'Failed to search similar models' },
      { status: 500 }
    );
  }
}