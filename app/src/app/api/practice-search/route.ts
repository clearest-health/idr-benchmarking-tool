import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const specialty = searchParams.get('specialty')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.length < 2) {
      return NextResponse.json({
        practices: [],
        message: 'Query too short. Please enter at least 2 characters.'
      })
    }

    // Build the base query - get distinct practice names with all relevant details
    let supabaseQuery = supabaseAdmin
      .from('idr_disputes')
      .select('provider_facility_name, practice_facility_specialty, location_of_service, practice_facility_size')
      .not('provider_facility_name', 'is', null)
      .ilike('provider_facility_name', `%${query}%`)

    // Add specialty filter if provided
    if (specialty) {
      supabaseQuery = supabaseQuery.eq('practice_facility_specialty', specialty)
    }

    const { data, error } = await supabaseQuery.limit(limit * 3) // Get more results to dedupe

    if (error) {
      console.error('Practice search error:', error)
      return NextResponse.json(
        { error: 'Failed to search practices' },
        { status: 500 }
      )
    }

    // Deduplicate and count manually, keeping most common specialty/location/size for each practice
    const practiceMap = new Map<string, {
      name: string
      specialty: string
      location: string
      size: string
      count: number
      specialtyCount: Map<string, number>
      locationCount: Map<string, number>
      sizeCount: Map<string, number>
    }>()

    data?.forEach(item => {
      const key = item.provider_facility_name
      if (practiceMap.has(key)) {
        const practice = practiceMap.get(key)!
        practice.count++
        
        // Count occurrences of each field to find most common
        if (item.practice_facility_specialty) {
          practice.specialtyCount.set(item.practice_facility_specialty, 
            (practice.specialtyCount.get(item.practice_facility_specialty) || 0) + 1)
        }
        if (item.location_of_service) {
          practice.locationCount.set(item.location_of_service,
            (practice.locationCount.get(item.location_of_service) || 0) + 1)
        }
        if (item.practice_facility_size) {
          practice.sizeCount.set(item.practice_facility_size,
            (practice.sizeCount.get(item.practice_facility_size) || 0) + 1)
        }
      } else {
        const specialtyCount = new Map<string, number>()
        const locationCount = new Map<string, number>()
        const sizeCount = new Map<string, number>()
        
        if (item.practice_facility_specialty) {
          specialtyCount.set(item.practice_facility_specialty, 1)
        }
        if (item.location_of_service) {
          locationCount.set(item.location_of_service, 1)
        }
        if (item.practice_facility_size) {
          sizeCount.set(item.practice_facility_size, 1)
        }

        practiceMap.set(key, {
          name: item.provider_facility_name,
          specialty: item.practice_facility_specialty || '',
          location: item.location_of_service || '',
          size: item.practice_facility_size || '',
          count: 1,
          specialtyCount,
          locationCount,
          sizeCount
        })
      }
    })

    // Convert to array and sort by count, using most common values for each field
    const practices = Array.from(practiceMap.values())
      .map(item => {
        // Find most common specialty, location, and size for this practice
        const mostCommonSpecialty = Array.from(item.specialtyCount.entries())
          .sort(([,a], [,b]) => b - a)[0]?.[0] || item.specialty
        const mostCommonLocation = Array.from(item.locationCount.entries())
          .sort(([,a], [,b]) => b - a)[0]?.[0] || item.location
        const mostCommonSize = Array.from(item.sizeCount.entries())
          .sort(([,a], [,b]) => b - a)[0]?.[0] || item.size

        return {
          name: item.name,
          specialty: mostCommonSpecialty,
          location: mostCommonLocation,
          size: mostCommonSize,
          disputeCount: item.count,
          displayName: `${item.name} (${mostCommonLocation}) - ${item.count} disputes`
        }
      })
      .sort((a, b) => b.disputeCount - a.disputeCount)
      .slice(0, limit)

    return NextResponse.json({
      practices,
      total: practices.length,
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
