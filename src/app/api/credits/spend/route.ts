import { NextRequest, NextResponse } from 'next/server'
import { spendCredits, hasEnoughCredits } from '@/lib/credits'

export async function POST(request: NextRequest) {
  try {
    const { userId, serviceType, metadata } = await request.json()

    if (!userId || !serviceType) {
      return NextResponse.json(
        { error: '用户ID和服务类型不能为空' },
        { status: 400 }
      )
    }

    // 检查服务类型是否有效
    const validServiceTypes = ['text-to-3d-preview', 'text-to-3d-optimized', 'image-generation']
    if (!validServiceTypes.includes(serviceType)) {
      return NextResponse.json(
        { error: '无效的服务类型' },
        { status: 400 }
      )
    }

    // 检查积分是否足够
    const hasEnough = await hasEnoughCredits(userId, serviceType)
    if (!hasEnough) {
      return NextResponse.json(
        { error: '积分不足' },
        { status: 402 } // 402 Payment Required
      )
    }

    // 消耗积分
    const result = await spendCredits(userId, serviceType, metadata)

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.transaction.id,
        amount: result.transaction.amount,
        description: result.transaction.description,
        createdAt: result.transaction.createdAt,
      },
      remainingCredits: result.remainingCredits,
      message: '积分扣除成功',
    })
  } catch (error) {
    console.error('消耗积分失败:', error)

    if (error instanceof Error && error.message === '积分不足') {
      return NextResponse.json(
        { error: '积分不足' },
        { status: 402 }
      )
    }

    return NextResponse.json(
      { error: '消耗积分失败' },
      { status: 500 }
    )
  }
}