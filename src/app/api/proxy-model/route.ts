import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate that the URL is from meshy.ai domain for security
    const meshyUrl = new URL(url);
    if (!meshyUrl.hostname.includes('meshy.ai')) {
      return NextResponse.json({ error: 'Invalid URL domain' }, { status: 400 });
    }

    console.log('Proxying model file from:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error proxying model file:', error);
    return NextResponse.json(
      { error: 'Failed to proxy model file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}