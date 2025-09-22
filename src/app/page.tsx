import ModelGenerator from '@/components/ModelGenerator';

export default function Home() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            AI 3D Model Generator
          </h1>
          <p className="text-muted-foreground">
            Turn your text into stunning 3D models using AI
          </p>
        </header>
        <ModelGenerator />
      </div>
    </div>
  );
}
