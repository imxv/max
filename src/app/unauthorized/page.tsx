'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import HeaderContent from '@/components/HeaderContent';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Access Denied
            </h1>
          </div>
          <HeaderContent />
        </div>
      </header>

      <div className="flex-1 flex justify-center items-center bg-zinc-50">
        <Card className="w-96 bg-red-50 border-red-200">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Access Denied</h1>
            <p className="text-red-600 mb-6">
              You do not have permission to access this page. Admin privileges are required.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Return to Home
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}