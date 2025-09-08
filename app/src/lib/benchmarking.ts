import { supabase, BenchmarkMetrics, BenchmarkFilters } from './supabase'

// Simple in-memory cache for filter options
const filterCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export class BenchmarkingService {
  /**
   * Get benchmark metrics for a specific provider profile
   */
  static async getProviderBenchmark(filters: BenchmarkFilters): Promise<BenchmarkMetrics | null> {
    try {
      // Build URL with practice name as query parameter if provided
      const params = new URLSearchParams()
      if (filters.practice_name) {
        params.append('practice_name', filters.practice_name)
      }
      
      const url = `/api/benchmark${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          type: 'provider'
        })
      })

      if (!response.ok) {
        console.error('API response not ok:', response.status)
        return null
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error in getProviderBenchmark:', error)
      return null
    }
  }

  /**
   * Get peer group benchmark (broader comparison)
   */
  static async getPeerBenchmark(filters: BenchmarkFilters): Promise<BenchmarkMetrics | null> {
    try {
      // For peer comparison, use same specialty but remove geographic and size restrictions
      const peerFilters = {
        specialty: filters.specialty,
        // Remove state and practice_size for broader comparison
        quarter: filters.quarter || '2024-Q4'
      }

      const response = await fetch('/api/benchmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: peerFilters,
          type: 'peer'
        })
      })

      if (!response.ok) {
        console.error('Peer benchmark API response not ok:', response.status)
        return null
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error in getPeerBenchmark:', error)
      return null
    }
  }

  /**
   * Get available filter options with optional dynamic filtering and caching
   */
  static async getFilterOptions(filters?: { 
    specialty?: string, 
    state?: string, 
    quarter?: string 
  }) {
    try {
      // Create cache key based on filter parameters
      const cacheKey = JSON.stringify(filters || {})
      const now = Date.now()
      
      // Check cache first
      const cached = filterCache.get(cacheKey)
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('Using cached filter options')
        return cached.data
      }

      const params = new URLSearchParams()
      if (filters?.specialty) params.append('specialty', filters.specialty)
      if (filters?.state) params.append('state', filters.state)
      if (filters?.quarter) params.append('quarter', filters.quarter)

      const response = await fetch(`/api/filters?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // If there's an error in the response, don't cache it and throw
      if (data.error) {
        throw new Error(data.error)
      }
      
      // Cache the response only if successful
      filterCache.set(cacheKey, { data, timestamp: now })
      
      // Clean up old cache entries (simple cleanup)
      if (filterCache.size > 20) {
        const oldestKey = filterCache.keys().next().value
        if (oldestKey) {
          filterCache.delete(oldestKey)
        }
      }
      
      return data
    } catch (error) {
      console.error('Error fetching filter options:', error)
      return {
        specialties: [],
        states: [],
        practice_sizes: [],
        top_service_codes: [],
        metadata: {}
      }
    }
  }

  /**
   * Get market overview statistics
   */
  static async getMarketOverview() {
    try {
      const { data, error } = await supabase
        .from('idr_disputes')
        .select(`
          payment_determination_outcome,
          practice_facility_specialty,
          location_of_service,
          data_quarter
        `)

      if (error) {
        console.error('Error fetching market overview:', error)
        return null
      }

      const totalDisputes = data.length
      const providerWins = data.filter(d => 
        d.payment_determination_outcome === 'In Favor of Provider/Facility/AA Provider'
      ).length
      const providerWinRate = (providerWins / totalDisputes) * 100

      // Top specialties by volume
      const specialtyCounts = data.reduce((acc, dispute) => {
        if (dispute.practice_facility_specialty) {
          acc[dispute.practice_facility_specialty] = (acc[dispute.practice_facility_specialty] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const topSpecialty = Object.entries(specialtyCounts)
        .sort(([,a], [,b]) => b - a)[0]

      // Top states by volume
      const stateCounts = data.reduce((acc, dispute) => {
        if (dispute.location_of_service) {
          acc[dispute.location_of_service] = (acc[dispute.location_of_service] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const topState = Object.entries(stateCounts)
        .sort(([,a], [,b]) => b - a)[0]

      return {
        total_disputes: totalDisputes,
        provider_win_rate: Math.round(providerWinRate * 10) / 10,
        top_specialty: topSpecialty ? {
          name: topSpecialty[0],
          count: topSpecialty[1],
          percentage: Math.round((topSpecialty[1] / totalDisputes) * 1000) / 10
        } : null,
        top_state: topState ? {
          name: topState[0],
          count: topState[1],
          percentage: Math.round((topState[1] / totalDisputes) * 1000) / 10
        } : null
      }
    } catch (error) {
      console.error('Error fetching market overview:', error)
      return null
    }
  }

  /**
   * Generate insights based on benchmark comparison
   */
  static generateInsights(providerMetrics: BenchmarkMetrics, peerMetrics: BenchmarkMetrics): Array<{
    type: 'success' | 'warning' | 'info'
    title: string
    message: string
  }> {
    const insights: Array<{
      type: 'success' | 'warning' | 'info'
      title: string
      message: string
    }> = []

    // Win rate insights
    const winRateDiff = providerMetrics.provider_win_rate - peerMetrics.provider_win_rate
    if (winRateDiff > 5) {
      insights.push({
        type: 'success',
        title: '🎯 Excellent Win Rate Performance',
        message: `Your win rate of ${providerMetrics.provider_win_rate.toFixed(1)}% is ${winRateDiff.toFixed(1)} percentage points above the peer average. This suggests strong case selection and preparation.`
      })
    } else if (winRateDiff < -5) {
      insights.push({
        type: 'warning',
        title: '⚠️ Win Rate Below Peers',
        message: `Your win rate of ${providerMetrics.provider_win_rate.toFixed(1)}% is ${Math.abs(winRateDiff).toFixed(1)} percentage points below peers. Consider reviewing case selection criteria and documentation quality.`
      })
    } else {
      insights.push({
        type: 'info',
        title: '📊 Win Rate In Line with Peers',
        message: `Your win rate of ${providerMetrics.provider_win_rate.toFixed(1)}% is close to the peer average, indicating consistent performance.`
      })
    }

    // Offer amount insights
    if (providerMetrics.avg_provider_offer_pct && peerMetrics.avg_provider_offer_pct) {
      const offerDiff = providerMetrics.avg_provider_offer_pct - peerMetrics.avg_provider_offer_pct
      if (offerDiff > 20) {
        insights.push({
          type: 'warning',
          title: '💰 High Offer Strategy',
          message: `Your average offer of ${providerMetrics.avg_provider_offer_pct.toFixed(0)}% QPA is ${offerDiff.toFixed(0)} points above peers. Ensure strong justification for higher amounts.`
        })
      } else if (offerDiff < -20) {
        insights.push({
          type: 'info',
          title: '💡 Conservative Offer Strategy',
          message: `Your offers are ${Math.abs(offerDiff).toFixed(0)} points below peers. You may have opportunities to request higher amounts with proper documentation.`
        })
      }
    }

    // Volume insights
    if (providerMetrics.total_disputes < 50) {
      insights.push({
        type: 'info',
        title: '📈 Limited Sample Size',
        message: `With ${providerMetrics.total_disputes} disputes, consider accumulating more data for robust benchmarking. Results may vary with larger samples.`
      })
    }

    return insights
  }
}
