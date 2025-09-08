import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, type = 'provider' } = body

    if (!filters) {
      return NextResponse.json(
        { error: 'Filters are required' },
        { status: 400 }
      )
    }

    // Determine the parameters based on benchmark type
    let params = {
      p_specialty: filters.specialty || null,
      p_state: type === 'provider' ? (filters.state || null) : null,
      p_practice_size: type === 'provider' ? (filters.practice_size || null) : null,
      p_service_codes: filters.service_codes || null,
      p_quarter: filters.quarter || '2024-Q4',
      p_practice_name: type === 'provider' ? (filters.practice_name || null) : null
    }

    // Call the stored procedure
    const { data, error } = await supabase.rpc('get_provider_benchmark', params)

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
      const { data, error } = await supabase
        .from('idr_disputes')
        .select(`
          payment_determination_outcome,
          practice_facility_specialty,
          location_of_service,
          data_quarter
        `)
        .limit(1000) // Limit for performance

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
