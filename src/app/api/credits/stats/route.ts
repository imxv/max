import { NextRequest, NextResponse } from 'next/server'
import { getCreditStats } from '@/lib/credits'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    const stats = await getCreditStats(userId)

    return NextResponse.json({
      success: true,
      ...stats,
    })
  } catch (error) {
    console.error('获取积分统计失败:', error)
    return NextResponse.json(
      { error: '获取积分统计失败' },
      { status: 500 }
    )
  }
}