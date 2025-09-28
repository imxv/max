import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '用户未认证' }, { status: 401 });
    }

    const { id: modelId } = await params;
    const { rating, comment } = await request.json();

    // Validate rating value
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if the model exists and belongs to the user
    const model = await prisma.generatedModel.findFirst({
      where: {
        id: modelId,
        userId: userId,
      },
    });

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      );
    }

    // Update the model with the rating and comment
    const updatedModel = await prisma.generatedModel.update({
      where: {
        id: modelId,
      },
      data: {
        rating: rating,
        comment: comment || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      rating: updatedModel.rating,
      comment: updatedModel.comment,
      message: 'Rating and comment saved successfully'
    });

  } catch (error) {
    console.error('Error saving model rating:', error);
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    );
  }
}