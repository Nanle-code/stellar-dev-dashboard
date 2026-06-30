import { useCallback, useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate, type SWRConfiguration, type SWRResponse } from 'swr'
import {
  CacheManager,
  TTL,
  stellarCacheManager,
} from '../lib/cacheManager'

export interface UseStellarSWROptions<Data = unknown> extends SWRConfiguration {
  cacheManager?: CacheManager
  ttl?: number
  tags?: string[]
}

const defaultSWRConfig: Partial<SWRConfiguration> = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  revalidateIfStale: true,
  revalidateOnMount: true,
}

export function useStellarSWR<Data = unknown>(
  key: string | null,
  fetcher: () => Promise<Data>,
  options: UseStellarSWROptions<Data> = {},
): SWRResponse<Data, Error> {
  const {
    cacheManager = stellarCacheManager,
    ttl = TTL.ACCOUNT,
    tags = [],
    ...swrOptions
  } = options

  const wrappedFetcher = useCallback(async () => {
    if (!key) {
      throw new Error('useStellarSWR requires a cache key')
    }
    return cacheManager.swr<Data>(key, fetcher, { ttl, tags })
  }, [key, fetcher, cacheManager, ttl, tags.join(',')])

  return useSWR<Data>(key, wrappedFetcher, {
    ...defaultSWRConfig,
    ...swrOptions,
  })
}

export function useAccount<Data = unknown>(
  publicKey: string | null,
  network: string,
  fetcher: (publicKey: string, network: string) => Promise<Data>,
): SWRResponse<Data, Error> {
  const key = publicKey ? `account:${publicKey}:${network}` : null
  return useStellarSWR<Data>(
    key,
    () => fetcher(publicKey!, network),
    {
      ttl: 300_000,
      tags: publicKey ? ['account', `account:${publicKey}`] : ['account'],
      dedupingInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    },
  )
}

export interface PaginatedResponse<T> {
  records: T[]
  nextCursor?: string | null
  hasMore?: boolean
}

export function useTransactions<RecordType = unknown>(
  publicKey: string | null,
  network: string,
  fetcher: (
    publicKey: string,
    network: string,
    limit: number,
    cursor: string | null,
  ) => Promise<PaginatedResponse<RecordType>>,
  limit = 20,
) {
  const [cursor, setCursor] = useState<string | null>(null)
  const [allRecords, setAllRecords] = useState<RecordType[]>([])
  const [hasMore, setHasMore] = useState(true)

  const key = publicKey ? `transactions:${publicKey}:${network}:${limit}:${cursor ?? 'null'}` : null

  const swr = useStellarSWR<PaginatedResponse<RecordType>>(
    key,
    () => fetcher(publicKey!, network, limit, cursor),
    {
      ttl: 60_000,
      tags: publicKey ? ['transactions', `account:${publicKey}`] : ['transactions'],
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  )

  useEffect(() => {
    if (!swr.data) return
    const records = swr.data.records ?? []
    setAllRecords((prev) => {
      const seen = new Set(prev.map((item: any) => item?.id ?? item))
      return [...prev, ...records.filter((item) => !seen.has((item as any)?.id ?? item))]
    })
    setHasMore(swr.data.hasMore ?? Boolean(swr.data.nextCursor))
  }, [swr.data])

  useEffect(() => {
    setAllRecords([])
    setHasMore(true)
    setCursor(null)
  }, [publicKey, network, limit])

  const loadMore = useCallback(() => {
    if (!swr.isValidating && hasMore && swr.data?.nextCursor) {
      setCursor(swr.data.nextCursor)
    }
  }, [hasMore, swr.data, swr.isValidating])

  return {
    ...swr,
    data: allRecords,
    loading: swr.isLoading,
    hasMore,
    loadMore,
    reset: () => {
      setAllRecords([])
      setCursor(null)
      setHasMore(true)
      swr.mutate()
    },
  }
}

export function useNetworkStats<Data = unknown>(
  network: string | null,
  fetcher: (network: string) => Promise<Data>,
  refreshInterval = 30_000,
) {
  const key = network ? `network-stats:${network}` : null
  return useStellarSWR<Data>(
    key,
    () => fetcher(network!),
    {
      ttl: 30_000,
      tags: ['network-stats'],
      refreshInterval,
      dedupingInterval: 15_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
}

export type OptimisticUpdater<Data> =
  | Data
  | ((previousData: Data | null) => Data)

export interface UseOptimisticMutationOptions<Data = unknown> {
  ttl?: number
  tags?: string[]
  optimisticData?: OptimisticUpdater<Data>
  onSuccess?: (value: Data) => void
  onError?: (error: unknown, rollback: () => void) => void
  onSettled?: () => void
}

export function useOptimisticMutation<Data = unknown>(
  cacheKey: string | null,
  mutationFn: () => Promise<Data>,
  options: UseOptimisticMutationOptions<Data> = {},
) {
  const {
    ttl = TTL.ACCOUNT,
    tags = [],
    optimisticData,
    onSuccess,
    onError,
    onSettled,
  } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const mutate = useCallback(async () => {
    if (!cacheKey) {
      throw new Error('useOptimisticMutation requires a cache key')
    }

    const previous = stellarCacheManager.get(cacheKey)
    const rollback = async () => {
      if (previous !== null) {
        await stellarCacheManager.set(cacheKey, previous, ttl, tags)
      } else {
        await stellarCacheManager.delete(cacheKey)
      }
      void globalMutate(cacheKey, previous as any, false)
    }

    setLoading(true)
    setError(null)

    try {
      let optimisticValue: Data | null = null
      if (optimisticData !== undefined) {
        optimisticValue = typeof optimisticData === 'function'
          ? (optimisticData as (prev: Data | null) => Data)(previous as Data | null)
          : optimisticData
      }

      if (optimisticValue !== null && optimisticValue !== undefined) {
        await stellarCacheManager.set(cacheKey, optimisticValue, ttl, tags)
        void globalMutate(cacheKey, optimisticValue, false)
      }

      const result = await mutationFn()
      await stellarCacheManager.set(cacheKey, result, ttl, tags)
      void globalMutate(cacheKey, result, false)
      onSuccess?.(result)
      return result
    } catch (err) {
      await rollback()
      setError(err)
      onError?.(err, rollback)
      throw err
    } finally {
      setLoading(false)
      onSettled?.()
    }
  }, [cacheKey, mutationFn, ttl, tags.join(','), optimisticData, onError, onSettled, onSuccess])

  return { mutate, loading, error }
}
