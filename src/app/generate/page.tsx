"use client";

import { useRouter } from 'next/navigation';
import ModelGenerator from '@/components/ModelGenerator';
import HeaderContent from '@/components/HeaderContent';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Generate() {
  const router = useRouter();

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="bg-background border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                AI 3D Model Generator
              </h1>
              <p className="text-sm text-muted-foreground">
                Turn your text into stunning 3D models using AI
              </p>
            </div>
          </div>
          <HeaderContent />
        </div>
      </header>

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        <ModelGenerator />
      </div>
    </div>
  );
}