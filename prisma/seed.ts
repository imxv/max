import prisma from '../src/lib/prisma'

async function main() {
  console.log('开始种子数据初始化...')

  // 创建服务类型配置
  const serviceTypes = [
    {
      name: 'text-to-3d-preview',
      description: '文本生成 3D (预览) - 网格生成',
      creditCost: 5,
    },
    {
      name: 'text-to-3d-optimized',
      description: '文本生成 3D (优化) - 纹理生成',
      creditCost: 10,
    },
    {
      name: 'image-generation',
      description: '图像生成模型',
      creditCost: 5,
    },
  ]

  console.log('创建服务类型配置...')
  for (const serviceType of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name: serviceType.name },
      update: {
        description: serviceType.description,
        creditCost: serviceType.creditCost,
      },
      create: serviceType,
    })
    console.log(`✓ 创建/更新服务类型: ${serviceType.description}`)
  }

  console.log('种子数据初始化完成!')
}

main()
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })