'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState, useCallback } from 'react'

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

export function useCredits() {
  const { user } = useUser()
  const [credits, setCredits] = useState<number>(0)
  const [stats, setStats] = useState<CreditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取积分余额
  const fetchCredits = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/credits/balance?userId=${user.id}`)
      if (!response.ok) throw new Error('获取积分失败')

      const data = await response.json()
      setCredits(data.credits)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取积分失败')
    }
  }, [user?.id])

  // 获取积分统计
  const fetchStats = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/credits/stats?userId=${user.id}`)
      if (!response.ok) throw new Error('获取积分统计失败')

      const data = await response.json()
      setStats(data)
      setCredits(data.currentCredits)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取积分统计失败')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // 获取积分历史
  const fetchHistory = async (limit = 20): Promise<CreditHistory[]> => {
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
  }

  // 检查积分是否足够
  const hasEnoughCredits = (serviceType: string): boolean => {
    const costs: Record<string, number> = {
      'text-to-3d-preview': 5,
      'text-to-3d-optimized': 10,
      'image-generation': 5,
    }

    return credits >= (costs[serviceType] || 0)
  }

  // 消耗积分
  const spendCredits = async (
    serviceType: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; remainingCredits?: number; error?: string }> => {
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

      setCredits(data.remainingCredits)
      return { success: true, remainingCredits: data.remainingCredits }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : '积分消耗失败'
      }
    }
  }

  // 初始化用户积分
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
  }, [user?.id, user?.emailAddresses, fetchCredits])

  useEffect(() => {
    if (user?.id) {
      fetchStats()
    }
  }, [user?.id, fetchStats])

  return {
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
  }
}
