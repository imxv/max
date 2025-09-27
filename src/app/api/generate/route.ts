import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasEnoughCredits, spendCredits, type ServiceType } from '@/lib/credits';
import { prisma } from '@/lib/prisma';
import { ModelStatus } from '@prisma/client';

const MESHY_API_KEY = 'msy_dummy_api_key_for_test_mode_12345678';
const MESHY_BASE_URL = 'https://api.meshy.ai';

// 根据操作类型确定服务类型和积分消费
function getServiceType(mode: string, isImageTo3D: boolean): ServiceType {
  if (mode === 'preview') {
    return isImageTo3D ? 'image-generation' : 'text-to-3d-preview';
  } else if (mode === 'refine') {
    return 'text-to-3d-optimized';
  }
  throw new Error(`无效的模式: ${mode}`);
}

export async function POST(request: NextRequest) {
  try {
    // 获取用户认证信息
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { prompt, mode = 'preview', previewTaskId, image_url, enablePbr, texturePrompt } = await request.json();

    // Determine if this is an image-to-3D or text-to-3D request
    const isImageTo3D = !!image_url;

    // 确定服务类型和积分消费
    const serviceType = getServiceType(mode, isImageTo3D);

    // 检查积分是否足够
    const hasEnough = await hasEnoughCredits(userId, serviceType);
    if (!hasEnough) {
      return NextResponse.json(
        { error: '积分不足，请充值后再试' },
        { status: 402 }
      );
    }

    if (!isImageTo3D && !prompt && mode === 'preview') {
      return NextResponse.json({ error: 'Prompt is required for text-to-3D preview mode' }, { status: 400 });
    }

    if (isImageTo3D && !image_url) {
      return NextResponse.json({ error: 'Image URL is required for image-to-3D mode' }, { status: 400 });
    }

    if (!previewTaskId && mode === 'refine') {
      return NextResponse.json({ error: 'Preview task ID is required for refine mode' }, { status: 400 });
    }

    let requestBody: {
      image_url?: string;
      enable_pbr?: boolean;
      should_remesh?: boolean;
      should_texture?: boolean;
      mode?: string;
      prompt?: string;
      art_style?: string;
      topology?: string;
      preview_task_id?: string;
      texture_prompt?: string;
      texture_image_url?: string;
    };
    let endpoint: string;

    if (isImageTo3D && mode === 'preview') {
      // Image to 3D generation (preview - white model without texture)
      requestBody = {
        image_url,
        enable_pbr: false,
        should_remesh: true,
        should_texture: false, // Generate white model without texture to save credits
      };
      endpoint = `${MESHY_BASE_URL}/openapi/v1/image-to-3d`;
    } else if (mode === 'preview') {
      // Text to 3D preview generation
      requestBody = {
        mode: 'preview',
        prompt,
        art_style: 'realistic',
        topology: 'quad'
      };
      endpoint = `${MESHY_BASE_URL}/openapi/v2/text-to-3d`;
    } else {
      // Text to 3D refine generation
      requestBody = {
        mode: 'refine',
        preview_task_id: previewTaskId,
        enable_pbr: enablePbr !== undefined ? enablePbr : true
      };

      if (texturePrompt) {
        requestBody.texture_prompt = texturePrompt;
      }

      if (image_url) {
        requestBody.texture_image_url = image_url;
      }

      endpoint = `${MESHY_BASE_URL}/openapi/v2/text-to-3d`;
    }

    console.log('Sending to Meshy API:', { endpoint, requestBody });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Meshy API error: ${response.status} - ${errorText}`);
      throw new Error(`Meshy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Meshy API response:', data);

    // Meshy API调用成功，扣除积分
    try {
      const spendResult = await spendCredits(userId, serviceType, {
        mode,
        isImageTo3D,
        prompt: prompt || 'image-to-3d',
        previewTaskId,
        taskId: data.result || data.id || data.task_id || data.taskId,
        timestamp: new Date().toISOString(),
      });

      console.log('积分扣除成功:', spendResult);

      // 保存模型记录到数据库
      const taskId = data.result || data.id || data.task_id || data.taskId;
      if (taskId) {
        try {
          await prisma.generatedModel.create({
            data: {
              id: taskId,
              userId: userId,
              serviceType,
              modelUrl: null, // Will be updated when model is ready
              thumbnailUrl: null, // Will be updated when model is ready
              prompt: prompt || (isImageTo3D ? 'Generated from uploaded image' : null),
              creditsCost: Math.abs(spendResult.transaction.amount),
              status: ModelStatus.PENDING,
            },
          });
          console.log('模型记录已创建:', taskId);
        } catch (dbError) {
          console.error('创建模型记录失败:', dbError);
          // 不抛出错误，继续执行，因为Meshy API调用已成功
        }
      }

      // 在响应中包含积分信息
      return NextResponse.json({
        ...data,
        creditInfo: {
          consumed: spendResult.transaction.amount * -1, // 转为正数显示
          remaining: spendResult.remainingCredits,
          serviceType
        }
      });
    } catch (creditError) {
      console.error('积分扣除失败:', creditError);
      // 即使积分扣除失败，也返回Meshy的结果，但记录错误
      return NextResponse.json({
        ...data,
        creditWarning: '积分扣除时发生错误，请联系客服'
      });
    }
  } catch (error) {
    console.error('Error generating 3D model:', error);
    return NextResponse.json(
      { error: 'Failed to generate 3D model', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const taskType = searchParams.get('taskType') || 'text-to-3d'; // default to text-to-3d

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log('Fetching status for task:', taskId, 'type:', taskType);

    let endpoint: string;
    if (taskType === 'image-to-3d') {
      endpoint = `${MESHY_BASE_URL}/openapi/v1/image-to-3d/${taskId}`;
    } else {
      endpoint = `${MESHY_BASE_URL}/openapi/v2/text-to-3d/${taskId}`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Meshy API error: ${response.status} - ${errorText}`);
      throw new Error(`Meshy API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Meshy API status response:', data);

    // Update model status in database if task is completed
    if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
      try {
        const modelUrl = data.model_urls?.glb || data.result?.model_urls?.glb;
        const thumbnailUrl = data.thumbnail_url || data.result?.thumbnail_url;

        await prisma.generatedModel.updateMany({
          where: {
            id: taskId,
          },
          data: {
            modelUrl: modelUrl || null,
            thumbnailUrl: thumbnailUrl || null,
            status: data.status === 'SUCCEEDED' ? ModelStatus.COMPLETED : ModelStatus.FAILED,
          },
        });
        console.log('模型状态已更新:', taskId, data.status);
      } catch (dbError) {
        console.error('更新模型状态失败:', dbError);
        // 不抛出错误，继续返回API结果
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching task status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}