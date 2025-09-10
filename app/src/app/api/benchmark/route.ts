import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, type = 'provider' } = body
    
    // Get additional parameters from URL
    const { searchParams } = new URL(request.url)
    const practiceNameParam = searchParams.get('practice_name')
    const emailDomainParam = searchParams.get('email_domain')
    const facilityGroupParam = searchParams.get('facility_group')

    if (!filters) {
      return NextResponse.json(
        { error: 'Filters are required' },
        { status: 400 }
      )
    }

    // Determine which stored procedure to call based on user type
    let procedureName = 'get_provider_benchmark'
    let params: Record<string, unknown> = {}

    switch (filters.user_type) {
      case 'law_firm':
        procedureName = 'get_law_firm_benchmark'
        params = {
          p_email_domain: emailDomainParam || null,
          p_specialty: filters.specialty || null,
          p_state: filters.state || null,
          p_quarter: filters.quarter || '2024-Q4'  // Default to Q4 if not specified
        }
        break
        
      case 'provider_group':
        procedureName = 'get_provider_group_benchmark'
        params = {
          p_facility_group: facilityGroupParam || null,
          p_specialty: filters.specialty || null,
          p_state: filters.state || null,
          p_quarter: filters.quarter || '2024-Q4'  // Default to Q4 if not specified
        }
        break
        
      default: // individual_provider
        procedureName = 'get_provider_benchmark'
        params = {
          p_specialty: filters.specialty || null,
          p_state: type === 'provider' ? (filters.state || null) : null,
          p_practice_size: type === 'provider' ? (filters.practice_size || null) : null,
          p_quarter: filters.quarter || '2024-Q4',  // Default to Q4 if not specified
          p_practice_name: type === 'provider' ? (practiceNameParam || null) : null
        }
    }

    console.log('🔍 Calling stored procedure:', procedureName, 'with params:', JSON.stringify(params, null, 2))

    // Call the appropriate stored procedure
    const { data, error } = await supabaseAdmin.rpc(procedureName, params)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No data found matching the specified criteria' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: data[0] })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'overview'

    if (type === 'overview') {
      // Get market overview statistics
      const { data, error } = await supabaseAdmin
        .from('idr_disputes')
        .select(`
          payment_determination_outcome,
          practice_facility_specialty,
          location_of_service,
          data_quarter
        `)
        .limit(5000) // Increased limit for better market overview statistics

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch market overview' },
          { status: 500 }
        )
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

      return NextResponse.json({
        total_disputes: totalDisputes,
        provider_win_rate: Math.round(providerWinRate * 10) / 10,
        top_specialty: topSpecialty ? {
          name: topSpecialty[0],
          percentage: Math.round((topSpecialty[1] / totalDisputes) * 1000) / 10
        } : null
      })
    }

    return NextResponse.json(
      { error: 'Invalid request type' },
      { status: 400 }
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
