import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const specialty = searchParams.get('specialty')
    const state = searchParams.get('state')
    const quarter = searchParams.get('quarter') || '2024-Q4'

    // Check if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey.includes('placeholder')) {
      console.error('❌ Supabase not configured properly')
      return NextResponse.json({
        error: 'Database not configured. Please set up NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
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

    // First, let's check what quarters are available
    console.log('🔍 Testing Supabase connection...')
    
    // Test basic connection
    const connectionTest = await supabase
      .from('idr_disputes')
      .select('count', { count: 'exact', head: true })
    
    console.log('Connection test result:', connectionTest)
    
    // Check what tables exist by trying different possible table names
    const tableTests = await Promise.all([
      supabase.from('idr_disputes').select('id').limit(1),
      supabase.from('disputes').select('id').limit(1),
      supabase.from('idr_data').select('id').limit(1),
      supabase.from('federal_idr_disputes').select('id').limit(1)
    ])
    
    console.log('Table existence tests:', tableTests.map((test, i) => ({
      table: ['idr_disputes', 'disputes', 'idr_data', 'federal_idr_disputes'][i],
      exists: !test.error,
      error: test.error?.message,
      hasData: test.data?.length > 0
    })))
    
    const quartersCheck = await supabase
      .from('idr_disputes')
      .select('data_quarter')
      .limit(10)

    console.log('Available quarters check:', quartersCheck)
    
    // Also test a simple select to see if we can get any data
    const simpleTest = await supabase
      .from('idr_disputes')
      .select('id, dispute_number, data_quarter')
      .limit(5)
      
    console.log('Simple data test:', simpleTest)
    
    if (quartersCheck.error) {
      console.error('❌ Database connection error:', quartersCheck.error)
      return NextResponse.json({
        error: 'Database connection failed: ' + quartersCheck.error.message,
        specialties: [],
        states: [],
        practice_sizes: [],
        top_service_codes: [],
        metadata: { 
          error: 'Database connection failed',
          quarter,
          total_specialties: 0,
          total_service_codes: 0
        }
      })
    }

    // Fetch all filter options in parallel, with dynamic filtering support
    const [specialtiesRes, statesRes, sizesRes, serviceCodesRes] = await Promise.all([
      // Get specialties with dispute counts for better sorting
      supabase
        .from('idr_disputes')
        .select('practice_facility_specialty, data_quarter')
        .not('practice_facility_specialty', 'is', null)
        .then(res => {
          if (res.error) {
            console.error('Specialties query error:', res.error)
            return res
          }
          
          console.log('Raw specialties data sample:', res.data?.slice(0, 5))
          
          // Filter by quarter if data exists for that quarter
          const quarterData = res.data?.filter(item => 
            !quarter || item.data_quarter === quarter
          ) || []
          
          console.log(`Filtered data for quarter ${quarter}:`, quarterData.length, 'records')
          
          // Count and sort by frequency
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
          
          console.log('Processed specialties:', sortedSpecialties.length, 'unique specialties')
          
          return { data: sortedSpecialties, error: null }
        }),
      
      // Get states from lookup table with full names
      supabase
        .from('states')
        .select('code, name')
        .order('name'),
      
      // Get practice sizes from lookup table
      supabase
        .from('practice_sizes')
        .select('size_range')
        .order('sort_order'),
      
      // Get top service codes with dynamic filtering
      supabase.rpc('get_top_service_codes', { 
        p_specialty: specialty,
        p_state: state,
        p_limit: 100 
      })
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

    // Process the data
    const specialties = specialtiesRes.data || []
    
    const states = statesRes.data?.map(s => ({
      code: s.code,
      name: s.name,
      display: `${s.name} (${s.code})`
    })) || []

    const practiceSizes = sizesRes.data?.map(d => d.size_range).filter(Boolean) || []

    const serviceCodes = serviceCodesRes.data || []

    // Check if database is empty
    const isDatabaseEmpty = quartersCheck.data?.length === 0
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
      top_service_codes: serviceCodes,
      error: errorMessage,
      metadata: {
        quarter,
        specialty_filter: specialty,
        state_filter: state,
        total_specialties: finalSpecialties.length,
        total_service_codes: serviceCodes.length,
        database_empty: isDatabaseEmpty,
        using_sample_data: isDatabaseEmpty && specialties.length === 0,
        debug_info: {
          quarters_found: quartersCheck.data?.map(q => q.data_quarter) || [],
          specialties_query_error: specialtiesRes.error?.message,
          service_codes_query_error: serviceCodesRes.error?.message,
          raw_quarters_count: quartersCheck.data?.length || 0,
          migration_needed: isDatabaseEmpty,
          connection_test: {
            error: connectionTest.error?.message,
            count: connectionTest.count,
            status: connectionTest.status
          },
          simple_test: {
            error: simpleTest.error?.message,
            data_length: simpleTest.data?.length || 0,
            sample_data: simpleTest.data?.slice(0, 2) || []
          },
          table_tests: tableTests.map((test, i) => ({
            table: ['idr_disputes', 'disputes', 'idr_data', 'federal_idr_disputes'][i],
            exists: !test.error,
            error: test.error?.message,
            hasData: test.data?.length > 0
          }))
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
