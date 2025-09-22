import { NextRequest, NextResponse } from 'next/server';

const MESHY_API_KEY = 'msy_dummy_api_key_for_test_mode_12345678';
const MESHY_BASE_URL = 'https://api.meshy.ai';

export async function POST(request: NextRequest) {
  try {
    const { prompt, mode = 'preview', previewTaskId } = await request.json();

    if (!prompt && mode === 'preview') {
      return NextResponse.json({ error: 'Prompt is required for preview mode' }, { status: 400 });
    }

    if (!previewTaskId && mode === 'refine') {
      return NextResponse.json({ error: 'Preview task ID is required for refine mode' }, { status: 400 });
    }

    const requestBody = mode === 'preview'
      ? {
          mode: 'preview',
          prompt,
          art_style: 'realistic',
          topology: 'quad'
        }
      : {
          mode: 'refine',
          preview_task_id: previewTaskId,
          enable_pbr: true
        };

    console.log('Sending to Meshy API:', requestBody);

    const response = await fetch(`${MESHY_BASE_URL}/openapi/v2/text-to-3d`, {
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

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log('Fetching status for task:', taskId);

    const response = await fetch(`${MESHY_BASE_URL}/openapi/v2/text-to-3d/${taskId}`, {
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