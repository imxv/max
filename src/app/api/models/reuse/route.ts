import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ModelStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { originalModelId, newPrompt } = await request.json();

    if (!originalModelId) {
      return NextResponse.json({ error: 'Original model ID is required' }, { status: 400 });
    }

    // 查找原始模型
    const originalModel = await prisma.generatedModel.findUnique({
      where: {
        id: originalModelId,
      },
    });

    if (!originalModel) {
      return NextResponse.json({ error: '原始模型不存在' }, { status: 404 });
    }

    if (originalModel.status !== ModelStatus.COMPLETED || !originalModel.modelUrl) {
      return NextResponse.json({ error: '只能重用已完成的模型' }, { status: 400 });
    }

    // 检查用户是否已经有这个模型的重用记录
    const existingReuse = await prisma.generatedModel.findFirst({
      where: {
        userId: userId,
        modelUrl: originalModel.modelUrl,
        prompt: newPrompt || originalModel.prompt,
      },
    });

    if (existingReuse) {
      return NextResponse.json({
        error: '您已经重用过这个模型',
        existingModel: existingReuse,
      }, { status: 409 });
    }

    // 创建新的模型记录（重用）
    const reusedModel = await prisma.generatedModel.create({
      data: {
        userId: userId,
        serviceType: originalModel.serviceType,
        modelUrl: originalModel.modelUrl,
        thumbnailUrl: originalModel.thumbnailUrl,
        prompt: newPrompt || originalModel.prompt,
        creditsCost: 0, // 重用不消耗积分
        status: ModelStatus.COMPLETED,
      },
    });

    // 如果原始模型不是用户自己的，可以记录重用统计（未来功能）
    if (originalModel.userId !== userId) {
      // 这里可以添加重用统计逻辑，比如增加原模型的重用次数
      // await prisma.modelReuseStats.create({...})
    }

    return NextResponse.json({
      success: true,
      reusedModel: {
        id: reusedModel.id,
        prompt: reusedModel.prompt,
        modelUrl: reusedModel.modelUrl,
        thumbnailUrl: reusedModel.thumbnailUrl,
        serviceType: reusedModel.serviceType,
        createdAt: reusedModel.createdAt,
        creditsCost: reusedModel.creditsCost,
        status: reusedModel.status,
      },
      originalModelId: originalModelId,
      message: '模型重用成功！',
    });

  } catch (error) {
    console.error('Error reusing model:', error);
    return NextResponse.json(
      { error: 'Failed to reuse model' },
      { status: 500 }
    );
  }
}