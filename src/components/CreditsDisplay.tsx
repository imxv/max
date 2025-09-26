'use client'

import { useCredits } from '@/hooks/useCredits'
import { SignedIn, useUser } from '@clerk/nextjs'
import { Coins } from 'lucide-react'
import { useEffect } from 'react'

export default function CreditsDisplay() {
  const { user } = useUser()
  const { credits, loading, error, initializeCredits } = useCredits()

  useEffect(() => {
    if (user?.id && user?.emailAddresses?.[0]?.emailAddress) {
      initializeCredits()
    }
  }, [user?.id, user?.emailAddresses, initializeCredits])

  if (!user) return null

  if (loading) {
    return (
      <SignedIn>
        <div className="flex items-center gap-2 bg-muted/50 text-muted-foreground px-3 py-1.5 rounded-full text-sm">
          <Coins className="w-4 h-4" />
          <span>加载中...</span>
        </div>
      </SignedIn>
    )
  }

  if (error) {
    return (
      <SignedIn>
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-sm">
          <Coins className="w-4 h-4" />
          <span>积分加载失败</span>
        </div>
      </SignedIn>
    )
  }

  return (
    <SignedIn>
      <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
        <Coins className="w-4 h-4" />
        <span>{credits} 积分</span>
      </div>
    </SignedIn>
  )
}