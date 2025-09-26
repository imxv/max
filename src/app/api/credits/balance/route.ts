import { NextRequest, NextResponse } from 'next/server'
import { getUserCredits } from '@/lib/credits'

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

    const credits = await getUserCredits(userId)

    return NextResponse.json({
      success: true,
      credits,
    })
  } catch (error) {
    console.error('获取用户积分失败:', error)
    return NextResponse.json(
      { error: '获取积分失败' },
      { status: 500 }
    )
  }
}