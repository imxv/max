import ModelGenerator from '@/components/ModelGenerator';

export default function Home() {
  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="bg-background border-b border-border px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">
          AI 3D Model Generator
        </h1>
        <p className="text-sm text-muted-foreground">
          Turn your text into stunning 3D models using AI
        </p>
      </header>

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        <ModelGenerator />
      </div>
    </div>
  );
}
