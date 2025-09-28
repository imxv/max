'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ModelRatingProps {
  modelId: string;
  currentRating?: number | null;
  onRatingSubmit: (rating: number) => Promise<void>;
  onClose?: () => void;
}

export default function ModelRating({
  modelId,
  currentRating,
  onRatingSubmit,
  onClose
}: ModelRatingProps) {
  const [rating, setRating] = useState<number>(currentRating || 0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleStarClick = (starRating: number) => {
    setRating(starRating);
  };

  const handleStarHover = (starRating: number) => {
    setHoveredRating(starRating);
  };

  const handleStarLeave = () => {
    setHoveredRating(0);
  };

  const handleSubmit = async () => {
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      await onRatingSubmit(rating);
      setIsSubmitted(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose?.();
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto bg-zinc-900 border-zinc-700">
        <CardContent className="p-4 text-center">
          <div className="text-emerald-400 text-2xl mb-2">✓</div>
          <p className="text-zinc-100 font-medium">Rating submitted!</p>
          <p className="text-zinc-400 text-sm">Thank you for your feedback</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-zinc-900 border-zinc-700">
      <CardContent className="p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-zinc-100 mb-2">
            Rate this model
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            How satisfied are you with the generated 3D model?
          </p>

          {/* Star Rating */}
          <div className="flex justify-center items-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= (hoveredRating || rating);
              return (
                <label
                  key={star}
                  className="cursor-pointer transition-transform duration-150 hover:scale-110"
                >
                  <input
                    type="radio"
                    name={`rating-${modelId}`}
                    value={star}
                    checked={rating === star}
                    onChange={() => handleStarClick(star)}
                    onMouseEnter={() => handleStarHover(star)}
                    onMouseLeave={handleStarLeave}
                    className="sr-only"
                    disabled={isSubmitting}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  />
                  <svg
                    className={`w-8 h-8 transition-colors duration-200 ${
                      isFilled
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-zinc-600 hover:text-amber-500/50'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </label>
              );
            })}
          </div>

          {/* Rating Labels */}
          {(hoveredRating || rating) > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-200">
                {hoveredRating || rating === 1 && '⭐ Poor'}
                {hoveredRating || rating === 2 && '⭐⭐ Fair'}
                {hoveredRating || rating === 3 && '⭐⭐⭐ Good'}
                {hoveredRating || rating === 4 && '⭐⭐⭐⭐ Very Good'}
                {hoveredRating || rating === 5 && '⭐⭐⭐⭐⭐ Excellent'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit Rating'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}