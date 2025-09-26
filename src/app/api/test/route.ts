import prisma from '@/lib/prisma'
import supabase from '@/lib/supabase'

export async function GET() {
  try {
    // 测试数据库连接
    await prisma.$connect()
    console.log('Database connected successfully')

    // 使用原生查询检查表是否存在
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('service_types', 'users', 'user_credits')
    `

    console.log('Tables found:', result)

    let supabaseStatus: {
      success: boolean
      message: string
      sample?: unknown
    } = {
      success: false,
      message: 'Supabase query not executed',
    }

    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name')
        .limit(1)

      if (error) {
        throw error
      }

      supabaseStatus = {
        success: true,
        message: 'Supabase query succeeded',
        sample: data,
      }
    } catch (supabaseError) {
      console.error('Supabase query failed:', supabaseError)
      supabaseStatus = {
        success: false,
        message:
          supabaseError instanceof Error
            ? supabaseError.message
            : 'Supabase query failed',
      }
    }

    return Response.json({
      success: true,
      message: '数据库连接正常',
      tables: result,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...',
      supabase: supabaseStatus,
    })
  } catch (error) {
    console.error('数据库连接测试失败:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '数据库连接失败',
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...'
    }, { status: 500 })
  }
}
