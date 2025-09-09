import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.length < 2) {
      return NextResponse.json({
        domains: [],
        message: 'Query too short. Please enter at least 2 characters.'
      })
    }

    // Use a more efficient query with aggregation to avoid duplicates
    const { data, error } = await supabaseAdmin
      .rpc('get_email_domains_with_counts', {
        search_query: query,
        result_limit: limit
      })
      .then(async (res) => {
        // Fallback to manual aggregation if RPC doesn't exist
        if (res.error) {
          const basicQuery = await supabaseAdmin
            .from('idr_disputes')
            .select('provider_email_domain')
            .not('provider_email_domain', 'is', null)
            .ilike('provider_email_domain', `%${query}%`)
            .limit(1000)

          if (basicQuery.error) {
            return { data: [], error: basicQuery.error }
          }

          // Manual deduplication and counting
          const domainMap = new Map<string, number>()
          
          basicQuery.data?.forEach(item => {
            const domain = item.provider_email_domain?.trim().toLowerCase()
            if (domain) {
              domainMap.set(domain, (domainMap.get(domain) || 0) + 1)
            }
          })

          const domains = Array.from(domainMap.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([domain, count]) => ({
              domain,
              dispute_count: count
            }))

          return { data: domains, error: null }
        }
        
        return res
      })

    if (error) {
      console.error('Email domain search error:', error)
      return NextResponse.json(
        { error: 'Failed to search email domains' },
        { status: 500 }
      )
    }

    // Format the response
    const domains = (data || []).map((item: { domain: string; dispute_count: number }) => ({
      domain: item.domain,
      disputeCount: item.dispute_count,
      displayName: `${item.domain} - ${item.dispute_count} disputes`
    }))

    return NextResponse.json({
      domains,
      total: domains.length,
      query
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
