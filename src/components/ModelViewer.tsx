'use client';

import { useEffect, useRef } from 'react';

interface ModelViewerProps {
  modelUrl: string;
}

export default function ModelViewer({ modelUrl }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Convert external model URL to proxied URL
  const getProxiedUrl = (url: string) => {
    if (url.includes('meshy.ai')) {
      return `/api/proxy-model?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  useEffect(() => {
    // Only load script once and only on client side
    if (!scriptLoadedRef.current && typeof window !== 'undefined') {
      const existingScript = document.querySelector('script[src*="model-viewer"]');

      if (!existingScript) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
        script.onload = () => {
          scriptLoadedRef.current = true;
        };
        document.head.appendChild(script);
      } else {
        scriptLoadedRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    // Update model-viewer when modelUrl changes
    if (containerRef.current && modelUrl) {
      const proxiedUrl = getProxiedUrl(modelUrl);
      containerRef.current.innerHTML = `
        <model-viewer
          src="${proxiedUrl}"
          alt="Generated 3D model"
          auto-rotate
          camera-controls
          style="width: 100%; height: 100%;"
          class="rounded-lg">
        </model-viewer>
      `;
    }
  }, [modelUrl]);

  if (!modelUrl) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🎯</div>
          <p>Your 3D model will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-96 bg-gray-100 rounded-lg"
      style={{ width: '100%', height: '100%' }}
    />
  );
}