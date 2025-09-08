import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const specialty = searchParams.get('specialty')
    const state = searchParams.get('state')
    const quarter = searchParams.get('quarter') || '2024-Q4'

    // Check if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('🔍 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0
    })

    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
      console.error('❌ Supabase not configured properly')
      return NextResponse.json({
        error: 'Database not configured. Please set up NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
        specialties: [],
        states: [],
        practice_sizes: [],
        top_service_codes: [],
        metadata: { 
          error: 'Database not configured',
          quarter,
          total_specialties: 0,
          total_service_codes: 0
        }
      })
    }

    // Fetch all filter options in parallel
    const [specialtiesRes, statesRes, sizesRes] = await Promise.all([
      // Get specialties with dispute counts for better sorting
      supabaseAdmin
        .from('idr_disputes')
        .select('practice_facility_specialty, data_quarter')
        .not('practice_facility_specialty', 'is', null)
        .then(res => {
          if (res.error) {
            console.error('Specialties query error:', res.error)
            return res
          }
          
          // Filter by quarter if data exists for that quarter
          const quarterData = res.data?.filter(item => 
            !quarter || item.data_quarter === quarter
          ) || []
          
          // Count and sort alphabetically
          const counts = quarterData.reduce((acc, item) => {
            const specialty = item.practice_facility_specialty
            if (specialty) {
              acc[specialty] = (acc[specialty] || 0) + 1
            }
            return acc
          }, {} as Record<string, number>)
          
          const sortedSpecialties = Object.entries(counts)
            .sort(([nameA,], [nameB,]) => nameA.localeCompare(nameB))
            .map(([name]) => name)
          
          return { data: sortedSpecialties, error: null }
        }),
      
      // Get states from lookup table with full names
      supabaseAdmin
        .from('states')
        .select('code, name')
        .order('name'),
      
      // Get practice sizes from lookup table
      supabaseAdmin
        .from('practice_sizes')
        .select('size_range')
        .order('sort_order')
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

    // Process the data
    const specialties = specialtiesRes.data || []
    
    const states = statesRes.data?.map(s => ({
      code: s.code,
      name: s.name,
      display: `${s.name} (${s.code})`
    })) || []

    const practiceSizes = sizesRes.data?.map(d => d.size_range).filter(Boolean) || []

    // Check if database is empty by looking at specialties data
    const isDatabaseEmpty = specialties.length === 0
    const errorMessage = isDatabaseEmpty ? 
      'Database table exists but is empty. Data may need to be migrated or there may be RLS policies blocking access.' : 
      null

    // If database is empty, provide sample data for development
    let finalSpecialties = specialties
    if (isDatabaseEmpty && specialties.length === 0) {
      finalSpecialties = [
        'Emergency Medicine',
        'Anesthesiology', 
        'Radiology',
        'Pathology',
        'Emergency Medicine - Pediatric',
        'Interventional Cardiology',
        'Neonatology',
        'Interventional Radiology',
        'Cardiothoracic Surgery',
        'Orthopedic Surgery'
      ]
    }

    return NextResponse.json({
      specialties: finalSpecialties,
      states,
      practice_sizes: practiceSizes,
      ...(errorMessage ? { error: errorMessage } : {}),
      metadata: {
        quarter,
        specialty_filter: specialty,
        state_filter: state,
        total_specialties: finalSpecialties.length,
        database_empty: isDatabaseEmpty,
        using_sample_data: isDatabaseEmpty && specialties.length === 0,
        debug_info: {
          migration_needed: isDatabaseEmpty,
          specialties_count: finalSpecialties.length
        }
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
