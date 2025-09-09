import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.length < 2) {
      return NextResponse.json({
        groups: [],
        message: 'Query too short. Please enter at least 2 characters.'
      })
    }

    // Use more efficient query with proper deduplication
    const { data, error } = await supabaseAdmin
      .from('idr_disputes')
      .select('provider_facility_group_name, location_of_service')
      .not('provider_facility_group_name', 'is', null)
      .ilike('provider_facility_group_name', `%${query}%`)
      .limit(2000) // Get enough data for proper deduplication

    if (error) {
      console.error('Facility group search error:', error)
      return NextResponse.json(
        { error: 'Failed to search facility groups' },
        { status: 500 }
      )
    }

    // Proper deduplication and counting
    const groupMap = new Map<string, {
      name: string
      locations: Set<string>
      count: number
    }>()

    data?.forEach(item => {
      const groupName = item.provider_facility_group_name?.trim()
      const location = item.location_of_service
      
      if (groupName) {
        const key = groupName.toLowerCase() // Use lowercase for deduplication
        
        if (groupMap.has(key)) {
          const group = groupMap.get(key)!
          group.count++
          if (location) group.locations.add(location)
        } else {
          groupMap.set(key, {
            name: groupName, // Keep original case
            locations: new Set(location ? [location] : []),
            count: 1
          })
        }
      }
    })

    // Convert to array and sort by count
    const groups = Array.from(groupMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => ({
        name: item.name,
        disputeCount: item.count,
        locationCount: item.locations.size,
        displayName: `${item.name} - ${item.count} disputes (${item.locations.size} states)`
      }))

    return NextResponse.json({
      groups,
      total: groups.length,
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
