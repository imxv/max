"use client";

import { useRouter } from 'next/navigation';
import GradientBlinds from '@/components/GradientBlinds';
import { Button } from '@/components/ui/button';

export default function Home() {
  const router = useRouter();

  const handleStartMax = () => {
    router.push('/generate');
  };

  return (
    <div className="h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <GradientBlinds
          gradientColors={['#FF9FFC', '#5227FF']}
          angle={-30}
          noise={0.2}
          blindCount={16}
          blindMinWidth={60}
          spotlightRadius={1.2}
          spotlightSoftness={0.5}
          spotlightOpacity={0.8}
          mouseDampening={0.05}
          distortAmount={0.1}
          shineDirection="left"
          mixBlendMode="lighten"
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 pointer-events-none">
        <div className="text-center space-y-6 max-w-4xl">
          <h1 className="text-6xl md:text-8xl font-bold text-white drop-shadow-lg">
            Max
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-md">
            AI 3D Model Generator
          </p>
          <p className="text-lg text-white/80 drop-shadow-md max-w-2xl mx-auto">
            Turn your text into stunning 3D models using artificial intelligence.
            Experience the future of 3D content creation.
          </p>
          <div className="pt-8">
            <Button
              onClick={handleStartMax}
              size="lg"
              className="px-12 py-6 text-lg font-semibold bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white shadow-xl hover:shadow-2xl transition-all duration-300 pointer-events-auto"
            >
              Start Max
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
