import { NextRequest, NextResponse } from 'next/server'
import { initializeUserCredits } from '@/lib/credits'

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: '用户ID和邮箱不能为空' },
        { status: 400 }
      )
    }

    const credits = await initializeUserCredits(userId, email)

    return NextResponse.json({
      success: true,
      credits: credits.currentCredits,
      message: '用户积分初始化成功',
    })
  } catch (error) {
    console.error('初始化用户积分失败:', error)
    return NextResponse.json(
      { error: '初始化积分失败' },
      { status: 500 }
    )
  }
}