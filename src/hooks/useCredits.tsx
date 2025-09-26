'use client'

import { useUser } from '@clerk/nextjs'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface CreditStats {
  currentCredits: number
  totalEarned: number
  totalSpent: number
  recentTransactions: Array<{
    id: string
    amount: number
    type: string
    description: string | null
    createdAt: string
    serviceType?: {
      name: string
      description: string | null
    } | null
  }>
}

interface CreditHistory {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
  balanceAfter: number
  serviceType?: {
    name: string
    description: string | null
  } | null
}

type SpendResponse = {
  success: boolean
  remainingCredits?: number
  error?: string
}

interface CreditsContextValue {
  credits: number
  stats: CreditStats | null
  loading: boolean
  error: string | null
  hasEnoughCredits: (serviceType: string) => boolean
  spendCredits: (
    serviceType: string,
    metadata?: Record<string, unknown>
  ) => Promise<SpendResponse>
  initializeCredits: () => Promise<void>
  fetchCredits: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchHistory: (limit?: number) => Promise<CreditHistory[]>
  refresh: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined)

function useCreditsStore(): CreditsContextValue {
  const { user } = useUser()
  const [credits, setCredits] = useState<number>(0)
  const [stats, setStats] = useState<CreditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setCredits(0)
    setStats(null)
    setError(null)
    setLoading(false)
  }, [])

  const fetchCredits = useCallback(async () => {
    if (!user?.id) {
      reset()
      return
    }

    try {
      const response = await fetch(`/api/credits/balance?userId=${user.id}`)
      if (!response.ok) throw new Error('获取积分失败')

      const data = await response.json()
      setCredits(data.credits ?? 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取积分失败')
    }
  }, [reset, user?.id])

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      reset()
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/credits/stats?userId=${user.id}`)
      if (!response.ok) throw new Error('获取积分统计失败')

      const data = await response.json()
      setStats(data)
      setCredits(data.currentCredits ?? 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取积分统计失败')
    } finally {
      setLoading(false)
    }
  }, [reset, user?.id])

  const fetchHistory = useCallback(async (limit = 20): Promise<CreditHistory[]> => {
    if (!user?.id) return []

    try {
      const response = await fetch(`/api/credits/history?userId=${user.id}&limit=${limit}`)
      if (!response.ok) throw new Error('获取积分历史失败')

      const data = await response.json()
      setError(null)
      return data.history ?? []
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取积分历史失败')
      return []
    }
  }, [user?.id])

  const hasEnoughCredits = useCallback((serviceType: string): boolean => {
    const costs: Record<string, number> = {
      'text-to-3d-preview': 5,
      'text-to-3d-optimized': 10,
      'image-generation': 5,
    }

    return credits >= (costs[serviceType] || 0)
  }, [credits])

  const spendCredits = useCallback(async (
    serviceType: string,
    metadata?: Record<string, unknown>
  ): Promise<SpendResponse> => {
    if (!user?.id) {
      return { success: false, error: '用户未登录' }
    }

    try {
      const response = await fetch('/api/credits/spend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          serviceType,
          metadata,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || '积分消耗失败' }
      }

      setCredits(data.remainingCredits ?? 0)
      return { success: true, remainingCredits: data.remainingCredits }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : '积分消耗失败'
      }
    }
  }, [user?.id])

  const initializeCredits = useCallback(async () => {
    if (!user?.id || !user?.emailAddresses?.[0]?.emailAddress) return

    try {
      await fetch('/api/credits/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.emailAddresses[0].emailAddress,
        }),
      })

      await fetchCredits()
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化积分失败')
    }
  }, [fetchCredits, user?.emailAddresses, user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchStats()
    } else {
      reset()
    }
  }, [fetchStats, reset, user?.id])

  return useMemo(() => ({
    credits,
    stats,
    loading,
    error,
    hasEnoughCredits,
    spendCredits,
    initializeCredits,
    fetchCredits,
    fetchStats,
    fetchHistory,
    refresh: fetchStats,
  }), [
    credits,
    stats,
    loading,
    error,
    hasEnoughCredits,
    spendCredits,
    initializeCredits,
    fetchCredits,
    fetchStats,
    fetchHistory,
  ])
}

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const value = useCreditsStore()
  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits(): CreditsContextValue {
  const context = useContext(CreditsContext)
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider')
  }
  return context
}
