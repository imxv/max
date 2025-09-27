import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ModelStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const rawLimit = searchParams.get('limit');
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : NaN;
    const limit = Number.isNaN(parsedLimit) || parsedLimit <= 0
      ? 50
      : Math.min(parsedLimit, 100); // Cap page size to prevent extreme queries

    const rawOffset = searchParams.get('offset');
    const parsedOffset = rawOffset !== null ? Number.parseInt(rawOffset, 10) : 0;
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    console.log('Fetching generated models', {
      userId,
      limit,
      offset,
      rawLimit,
      rawOffset,
    });

    const models = await prisma.generatedModel.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.generatedModel.count({
      where: { userId }
    });

    return NextResponse.json({
      models,
      total,
    });

  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch models',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const {
      taskId,
      serviceType,
      modelUrl,
      thumbnailUrl,
      prompt,
      creditsCost,
      status = ModelStatus.COMPLETED,
    } = await request.json();

    if (!taskId || !serviceType || !creditsCost) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, serviceType, creditsCost' },
        { status: 400 }
      );
    }

    // Check if model with this taskId already exists
    const existingModel = await prisma.generatedModel.findFirst({
      where: {
        id: taskId,
        userId: userId,
      },
    });

    if (existingModel) {
      // Update existing model
      const updatedModel = await prisma.generatedModel.update({
        where: {
          id: taskId,
        },
        data: {
          modelUrl,
          thumbnailUrl,
          status,
        },
      });
      return NextResponse.json(updatedModel);
    } else {
      // Create new model record
      const model = await prisma.generatedModel.create({
        data: {
          id: taskId,
          userId: userId,
          serviceType,
          modelUrl,
          thumbnailUrl,
          prompt,
          creditsCost,
          status,
        },
      });

      return NextResponse.json(model);
    }

  } catch (error) {
    console.error('Error saving model:', error);
    return NextResponse.json(
      { error: 'Failed to save model' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('id');

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    // Check if the model belongs to the user
    const model = await prisma.generatedModel.findFirst({
      where: {
        id: modelId,
        userId: userId,
      },
    });

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.generatedModel.delete({
      where: {
        id: modelId,
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
