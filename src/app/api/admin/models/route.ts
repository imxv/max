import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const rawLimit = searchParams.get('limit');
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : NaN;
    const limit = Number.isNaN(parsedLimit) || parsedLimit <= 0
      ? 50
      : Math.min(parsedLimit, 200);

    const rawOffset = searchParams.get('offset');
    const parsedOffset = rawOffset !== null ? Number.parseInt(rawOffset, 10) : 0;
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    console.log('Admin fetching all models', {
      limit,
      offset,
    });

    // 获取所有模型，关联用户信息
    const models = await prisma.generatedModel.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.generatedModel.count();

    // 计算一些基础统计
    const totalRatedModels = await prisma.generatedModel.count({
      where: { rating: { not: null } }
    });

    const avgRating = await prisma.generatedModel.aggregate({
      where: { rating: { not: null } },
      _avg: {
        rating: true
      }
    });

    return NextResponse.json({
      models,
      total,
      stats: {
        totalRatedModels,
        averageRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 100) / 100 : 0
      }
    });

  } catch (error) {
    console.error('Error fetching admin models:', error);

    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch models',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}