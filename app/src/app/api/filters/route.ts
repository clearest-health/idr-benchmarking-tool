import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch all filter options in parallel
    const [specialtiesRes, statesRes, sizesRes, serviceCodesRes] = await Promise.all([
      // Get unique specialties
      supabase
        .from('idr_disputes')
        .select('practice_facility_specialty')
        .not('practice_facility_specialty', 'is', null)
        .order('practice_facility_specialty'),
      
      // Get unique states
      supabase
        .from('idr_disputes')
        .select('location_of_service')
        .not('location_of_service', 'is', null)
        .order('location_of_service'),
      
      // Get unique practice sizes
      supabase
        .from('practice_sizes')
        .select('size_range')
        .order('sort_order'),
      
      // Get top service codes
      supabase.rpc('get_top_service_codes', { p_limit: 50 })
    ])

    // Check for errors
    if (specialtiesRes.error) {
      console.error('Error fetching specialties:', specialtiesRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch specialties' },
        { status: 500 }
      )
    }

    if (statesRes.error) {
      console.error('Error fetching states:', statesRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch states' },
        { status: 500 }
      )
    }

    if (sizesRes.error) {
      console.error('Error fetching practice sizes:', sizesRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch practice sizes' },
        { status: 500 }
      )
    }

    if (serviceCodesRes.error) {
      console.error('Error fetching service codes:', serviceCodesRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch service codes' },
        { status: 500 }
      )
    }

    // Process and deduplicate the data
    const specialties = [...new Set(
      specialtiesRes.data?.map(d => d.practice_facility_specialty).filter(Boolean) || []
    )].sort()

    const states = [...new Set(
      statesRes.data?.map(d => d.location_of_service).filter(Boolean) || []
    )].sort()

    const practiceSizes = sizesRes.data?.map(d => d.size_range).filter(Boolean) || []

    const serviceCodes = serviceCodesRes.data || []

    return NextResponse.json({
      specialties,
      states,
      practice_sizes: practiceSizes,
      top_service_codes: serviceCodes
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
