import { NextRequest, NextResponse } from 'next/server';

const MESHY_API_KEY = 'msy_dummy_api_key_for_test_mode_12345678';
const MESHY_BASE_URL = 'https://api.meshy.ai';

export async function POST(request: NextRequest) {
  try {
    const { prompt, mode = 'preview', previewTaskId, image_url, enablePbr, texturePrompt } = await request.json();

    // Determine if this is an image-to-3D or text-to-3D request
    const isImageTo3D = !!image_url;

    if (!isImageTo3D && !prompt && mode === 'preview') {
      return NextResponse.json({ error: 'Prompt is required for text-to-3D preview mode' }, { status: 400 });
    }

    if (isImageTo3D && !image_url) {
      return NextResponse.json({ error: 'Image URL is required for image-to-3D mode' }, { status: 400 });
    }

    if (!previewTaskId && mode === 'refine') {
      return NextResponse.json({ error: 'Preview task ID is required for refine mode' }, { status: 400 });
    }

    let requestBody: any;
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
        requestBody.texture_richness = texturePrompt;
      }

      if (image_url) {
        requestBody.image_url = image_url;
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
    return NextResponse.json(data);
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
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching task status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}