import { NextRequest, NextResponse } from 'next/server'
import { getCreditHistory } from '@/lib/credits'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    const history = await getCreditHistory(userId, limit)

    return NextResponse.json({
      success: true,
      history,
    })
  } catch (error) {
    console.error('获取积分历史失败:', error)
    return NextResponse.json(
      { error: '获取积分历史失败' },
      { status: 500 }
    )
  }
}