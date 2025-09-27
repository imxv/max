import prisma from './prisma'

// 服务类型配置
export const SERVICE_COSTS = {
  'text-to-3d-preview': 5,      // 文本生成 3D (预览) - 网格生成
  'text-to-3d-optimized': 10,   // 文本生成 3D (优化) - 纹理生成
  'image-generation': 5,        // 图像生成模型
} as const

export type ServiceType = keyof typeof SERVICE_COSTS

// 初始化用户积分账户
export async function initializeUserCredits(userId: string, email: string) {
  try {
    // 创建或获取用户
    await prisma.user.upsert({
      where: { id: userId },
      update: { email },
      create: {
        id: userId,
        email,
      },
    })

    // 创建积分账户（如果不存在）
    const credits = await prisma.userCredits.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currentCredits: 45,
        totalEarned: 45,
        totalSpent: 0,
      },
    })

    // 记录初始积分交易
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: {
        userId,
        type: 'EARN',
        description: '注册奖励',
      },
    })

    if (!existingTransaction) {
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: 45,
          type: 'EARN',
          description: '注册奖励',
          balanceAfter: 45,
        },
      })
    }

    return credits
  } catch (error) {
    console.error('初始化用户积分失败:', error)
    throw error
  }
}

// 获取用户积分余额
export async function getUserCredits(userId: string) {
  const credits = await prisma.userCredits.findUnique({
    where: { userId },
  })

  return credits?.currentCredits ?? 0
}

// 检查用户是否有足够积分
export async function hasEnoughCredits(userId: string, serviceType: ServiceType) {
  const currentCredits = await getUserCredits(userId)
  const requiredCredits = SERVICE_COSTS[serviceType]

  return currentCredits >= requiredCredits
}

// 消耗积分
export async function spendCredits(
  userId: string,
  serviceType: ServiceType,
  metadata?: Record<string, unknown>
) {
  const requiredCredits = SERVICE_COSTS[serviceType]

  return await prisma.$transaction(async (tx) => {
    // 获取当前积分
    const userCredits = await tx.userCredits.findUnique({
      where: { userId },
    })

    if (!userCredits || userCredits.currentCredits < requiredCredits) {
      throw new Error('积分不足')
    }

    // 更新积分余额
    const updatedCredits = await tx.userCredits.update({
      where: { userId },
      data: {
        currentCredits: userCredits.currentCredits - requiredCredits,
        totalSpent: userCredits.totalSpent + requiredCredits,
      },
    })

    // 获取服务类型配置
    const serviceConfig = await tx.serviceType.findUnique({
      where: { name: serviceType },
    })

    // 记录交易
    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        serviceTypeId: serviceConfig?.id,
        amount: -requiredCredits,
        type: 'SPEND',
        description: `使用${serviceType}服务`,
        balanceAfter: updatedCredits.currentCredits,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    })

    return {
      transaction,
      remainingCredits: updatedCredits.currentCredits,
    }
  })
}

// 添加积分（充值、奖励等）
export async function addCredits(
  userId: string,
  amount: number,
  type: 'EARN' | 'BONUS' | 'REFUND' = 'EARN',
  description?: string
) {
  return await prisma.$transaction(async (tx) => {
    // 更新积分余额
    const updatedCredits = await tx.userCredits.upsert({
      where: { userId },
      update: {
        currentCredits: { increment: amount },
        totalEarned: { increment: amount },
      },
      create: {
        userId,
        currentCredits: amount,
        totalEarned: amount,
        totalSpent: 0,
      },
    })

    // 记录交易
    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        type,
        description: description || `获得${amount}积分`,
        balanceAfter: updatedCredits.currentCredits,
      },
    })

    return {
      transaction,
      newBalance: updatedCredits.currentCredits,
    }
  })
}

// 获取用户积分历史
export async function getCreditHistory(userId: string, limit = 20) {
  return await prisma.creditTransaction.findMany({
    where: { userId },
    include: {
      serviceType: {
        select: {
          name: true,
          description: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })
}

// 获取用户积分统计
export async function getCreditStats(userId: string) {
  const credits = await prisma.userCredits.findUnique({
    where: { userId },
  })

  const recentTransactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      serviceType: {
        select: {
          name: true,
          description: true,
        },
      },
    },
  })

  return {
    currentCredits: credits?.currentCredits ?? 0,
    totalEarned: credits?.totalEarned ?? 0,
    totalSpent: credits?.totalSpent ?? 0,
    recentTransactions,
  }
}

// 退款积分
export async function refundCredits(
  userId: string,
  amount: number,
  reason?: string
) {
  return await addCredits(userId, amount, 'REFUND', reason || '积分退款')
}

// 获取所有服务类型配置
export async function getServiceTypes() {
  return await prisma.serviceType.findMany({
    where: { isActive: true },
    orderBy: { creditCost: 'asc' },
  })
}