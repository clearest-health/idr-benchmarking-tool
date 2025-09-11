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
          p_quarter: filters.quarter || null  // Use specific quarter or null for all quarters
        }
        break
        
      case 'provider_group':
        procedureName = 'get_provider_group_benchmark'
        params = {
          p_facility_group: facilityGroupParam || null,
          p_specialty: filters.specialty || null,
          p_state: filters.state || null,
          p_quarter: filters.quarter || null  // Use specific quarter or null for all quarters
        }
        break
        
      default: // individual_provider
        procedureName = 'get_provider_benchmark'
        params = {
          p_specialty: filters.specialty || null,
          p_state: type === 'provider' ? (filters.state || null) : null,
          p_practice_size: type === 'provider' ? (filters.practice_size || null) : null,
          p_quarter: filters.quarter || null,  // Use specific quarter or null for all quarters
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

    // Add analytics data to the response
    let analyticsData: Record<string, unknown> = {}
    
    try {
      // Build WHERE conditions for analytics queries based on the same filters
      const whereConditions: string[] = []
      
      switch (filters.user_type) {
        case 'law_firm':
          if (emailDomainParam) {
            whereConditions.push(`provider_email_domain = '${emailDomainParam}'`)
          }
          break
          
        case 'provider_group':
          if (facilityGroupParam) {
            whereConditions.push(`provider_facility_group_name ILIKE '%${facilityGroupParam}%'`)
          }
          break
          
        case 'individual_provider':
          if (practiceNameParam) {
            whereConditions.push(`provider_facility_name = '${practiceNameParam}'`)
          }
          break
      }

      // Add optional filters
      if (filters.specialty) {
        whereConditions.push(`practice_facility_specialty = '${filters.specialty}'`)
      }
      if (filters.state) {
        whereConditions.push(`location_of_service = '${filters.state}'`)
      }
      if (filters.practice_size) {
        whereConditions.push(`practice_facility_size = '${filters.practice_size}'`)
      }

      // Build Supabase query for Service Code analysis (CPT, HCPCS, DRG, N/R)
      let serviceCodeQuery = supabaseAdmin
        .from('idr_disputes')
        .select(`
          service_code,
          type_of_service_code,
          payment_determination_outcome,
          provider_offer_pct_qpa,
          prevailing_party_offer_pct_qpa
        `)
        .not('service_code', 'is', null)
        .limit(50000) // Increase limit to ensure we get all service code types
        
      // Also get a count of cases WITHOUT service codes for debugging
      let missingServiceCodeQuery = supabaseAdmin
        .from('idr_disputes')
        .select('*', { count: 'exact', head: true })
        .is('service_code', null)

      let quarterlyQuery = supabaseAdmin
        .from('idr_disputes')
        .select(`
          data_quarter,
          payment_determination_outcome,
          provider_offer_pct_qpa,
          prevailing_party_offer_pct_qpa
        `)
        .limit(50000) // Increase limit for quarterly analysis too
        
      // Apply quarter filtering to all queries if specified
      if (filters.quarter) {
        serviceCodeQuery = serviceCodeQuery.eq('data_quarter', filters.quarter)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('data_quarter', filters.quarter)
        quarterlyQuery = quarterlyQuery.eq('data_quarter', filters.quarter)
      }

      // Apply filters to all queries - skip analytics if no specific identifier
      let hasSpecificFilter = false
      
      if (filters.user_type === 'law_firm' && emailDomainParam) {
        serviceCodeQuery = serviceCodeQuery.eq('provider_email_domain', emailDomainParam)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('provider_email_domain', emailDomainParam)
        quarterlyQuery = quarterlyQuery.eq('provider_email_domain', emailDomainParam)
        hasSpecificFilter = true
      } else if (filters.user_type === 'provider_group' && facilityGroupParam) {
        serviceCodeQuery = serviceCodeQuery.ilike('provider_facility_group_name', `%${facilityGroupParam}%`)
        missingServiceCodeQuery = missingServiceCodeQuery.ilike('provider_facility_group_name', `%${facilityGroupParam}%`)
        quarterlyQuery = quarterlyQuery.ilike('provider_facility_group_name', `%${facilityGroupParam}%`)
        hasSpecificFilter = true
      } else if (filters.user_type === 'individual_provider' && practiceNameParam) {
        serviceCodeQuery = serviceCodeQuery.eq('provider_facility_name', practiceNameParam)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('provider_facility_name', practiceNameParam)
        quarterlyQuery = quarterlyQuery.eq('provider_facility_name', practiceNameParam)
        hasSpecificFilter = true
      }
      
      // If no specific identifier, skip analytics
      if (!hasSpecificFilter) {
        analyticsData = { message: 'Analytics available only with specific practice/firm identification' }
      } else {

      // Apply standard filters to all queries (these should match the stored procedure filters)
      if (filters.specialty) {
        serviceCodeQuery = serviceCodeQuery.eq('practice_facility_specialty', filters.specialty)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('practice_facility_specialty', filters.specialty)
        quarterlyQuery = quarterlyQuery.eq('practice_facility_specialty', filters.specialty)
      }
      if (filters.state) {
        serviceCodeQuery = serviceCodeQuery.eq('location_of_service', filters.state)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('location_of_service', filters.state)
        quarterlyQuery = quarterlyQuery.eq('location_of_service', filters.state)
      }
      if (filters.practice_size && filters.user_type !== 'law_firm') {
        // Note: practice_size is only relevant for individual providers, not law firms
        serviceCodeQuery = serviceCodeQuery.eq('practice_facility_size', filters.practice_size)
        missingServiceCodeQuery = missingServiceCodeQuery.eq('practice_facility_size', filters.practice_size)
        quarterlyQuery = quarterlyQuery.eq('practice_facility_size', filters.practice_size)
      }

      // Execute all analytics queries
      const [serviceCodeResult, missingServiceCodeResult, quarterlyResult] = await Promise.all([
        serviceCodeQuery,
        missingServiceCodeQuery,
        quarterlyQuery
      ])

      // Process Service Code data (CPT, HCPCS, N/R, DRG)
      if (serviceCodeResult.data && !serviceCodeResult.error) {
        const serviceCodeMap = new Map()
        
        // Debug: Analyze the raw data structure
        console.log('🔍 Total service code rows returned:', serviceCodeResult.data.length)
        console.log('🔍 First 5 service code rows:', serviceCodeResult.data.slice(0, 5).map(row => ({
          service_code: row.service_code,
          type_of_service_code: row.type_of_service_code,
          outcome: row.payment_determination_outcome
        })))
        
        // Check what service code types we have in the raw data
        const rawTypeCount = serviceCodeResult.data.reduce((counts, row) => {
          const type = row.type_of_service_code || 'null'
          counts[type] = (counts[type] || 0) + 1
          return counts
        }, {} as Record<string, number>)
        console.log('🔍 Raw service code types in data:', rawTypeCount)
        
        // Check for duplicate service codes with different types (for debugging)
        const codeTypeCheck = new Map()
        serviceCodeResult.data.forEach(row => {
          const code = row.service_code
          if (!codeTypeCheck.has(code)) {
            codeTypeCheck.set(code, new Set())
          }
          codeTypeCheck.get(code).add(row.type_of_service_code || 'null')
        })
        
        const codesWithMultipleTypes = Array.from(codeTypeCheck.entries())
          .filter(([, types]) => types.size > 1)
        
        if (codesWithMultipleTypes.length > 0) {
          console.log('🔍 Service codes with multiple types:', codesWithMultipleTypes.slice(0, 3).map(([code, types]) => ({
            code,
            types: Array.from(types)
          })))
        }
        
        // The issue: We should count TOTAL DISPUTES, not sum of service code entries
        // Each row represents one dispute, so total disputes = serviceCodeResult.data.length
        const actualTotalDisputes = serviceCodeResult.data.length
        console.log('🔍 Actual total disputes (should match this):', actualTotalDisputes)
        
        serviceCodeResult.data.forEach((row: {
          service_code: string;
          type_of_service_code: string;
          payment_determination_outcome: string;
          provider_offer_pct_qpa?: number;
          prevailing_party_offer_pct_qpa?: number;
        }) => {
          const code = row.service_code
          const codeType = row.type_of_service_code || 'Unknown'
          const key = `${code}|${codeType}` // Use compound key to handle same codes with different types
          
          if (!serviceCodeMap.has(key)) {
            serviceCodeMap.set(key, {
              service_code: code,
              type_of_service_code: codeType,
              total_disputes: 0,
              wins: 0,
              losses: 0,
              provider_offers: [],
              winning_offers: []
            })
          }
          
          const entry = serviceCodeMap.get(key)
          entry.total_disputes++
          
          if (row.payment_determination_outcome === 'In Favor of Provider/Facility/AA Provider') {
            entry.wins++
          } else {
            entry.losses++
          }
          
          if (row.provider_offer_pct_qpa) entry.provider_offers.push(row.provider_offer_pct_qpa)
          if (row.prevailing_party_offer_pct_qpa) entry.winning_offers.push(row.prevailing_party_offer_pct_qpa)
        })

        const allServiceCodeEntries = Array.from(serviceCodeMap.values())
        // Temporarily remove the 3-case minimum to see all service code types
        const filteredServiceCodeEntries = allServiceCodeEntries.filter(entry => entry.total_disputes >= 1)
        
        // Calculate totals for summary - FIXED: Use actual dispute count, not sum of service code entries
        const totalServiceCodeCases = actualTotalDisputes // This is the correct total disputes
        const totalServiceCodeWins = serviceCodeResult.data.filter(row => 
          row.payment_determination_outcome === 'In Favor of Provider/Facility/AA Provider'
        ).length
        
        // Group by service code type for summary stats - FIXED: Count from raw data, not aggregated entries
        const typeStats = serviceCodeResult.data.reduce((stats, row) => {
          const type = row.type_of_service_code || 'Unknown'
          if (!stats[type]) {
            stats[type] = { count: new Set(), cases: 0, wins: 0 }
          }
          stats[type].count.add(row.service_code) // Count unique service codes per type
          stats[type].cases++ // Count total cases per type
          if (row.payment_determination_outcome === 'In Favor of Provider/Facility/AA Provider') {
            stats[type].wins++
          }
          return stats
        }, {} as Record<string, { count: Set<string>, cases: number, wins: number }>)
        
        // Convert Sets to counts for final output
        const finalTypeStats = Object.entries(typeStats).reduce((final, [type, data]) => {
          final[type] = {
            count: data.count.size, // Number of unique service codes
            cases: data.cases,      // Number of total cases/disputes
            wins: data.wins         // Number of wins
          }
          return final
        }, {} as Record<string, { count: number, cases: number, wins: number }>)
        
        // Debug logging to see what types we have
        console.log('🔍 Service Code Type Stats (CORRECTED):', finalTypeStats)
        console.log('🔍 Total Service Code Entries (unique codes):', allServiceCodeEntries.length)
        console.log('🔍 Total Disputes (actual):', totalServiceCodeCases)
        console.log('🔍 Verification - Sum of type cases should equal total:', Object.values(finalTypeStats).reduce((sum, stat) => sum + stat.cases, 0))
        console.log('🔍 Sample entries:', allServiceCodeEntries.slice(0, 5).map(e => ({ 
          code: e.service_code, 
          type: e.type_of_service_code, 
          cases: e.total_disputes 
        })))
        
        analyticsData.service_code_analysis = filteredServiceCodeEntries
          .map(entry => ({
            service_code: entry.service_code,
            type_of_service_code: entry.type_of_service_code,
            total_disputes: entry.total_disputes,
            wins: entry.wins,
            losses: entry.losses,
            win_rate: Math.round((entry.wins / entry.total_disputes) * 100 * 10) / 10,
            avg_provider_offer_pct: entry.provider_offers.length > 0 
              ? Math.round((entry.provider_offers.reduce((a: number, b: number) => a + b, 0) / entry.provider_offers.length) * 10) / 10 
              : null,
            avg_winning_offer_pct: entry.winning_offers.length > 0 
              ? Math.round((entry.winning_offers.reduce((a: number, b: number) => a + b, 0) / entry.winning_offers.length) * 10) / 10 
              : null
          }))
          .sort((a, b) => b.total_disputes - a.total_disputes) // Sort by largest volume
          .slice(0, 100)
          
        // Add summary information including missing service code count
        const missingServiceCodeCount = missingServiceCodeResult?.count || 0
        
        analyticsData.service_code_summary = {
          total_cases_with_service_codes: totalServiceCodeCases,
          total_wins_with_service_codes: totalServiceCodeWins,
          cases_missing_service_codes: missingServiceCodeCount,
          total_service_codes: allServiceCodeEntries.length,
          displayed_service_codes: filteredServiceCodeEntries.length,
          total_cases_in_analytics: totalServiceCodeCases + missingServiceCodeCount,
          quarter_filter_applied: filters.quarter || 'All quarters',
          service_code_types: finalTypeStats,
          note: missingServiceCodeCount > 0 
            ? `WARNING: ${missingServiceCodeCount} cases are missing service codes - this indicates a data quality issue`
            : 'All cases have service codes'
        }
      }

      // Process quarterly data
      if (quarterlyResult.data && !quarterlyResult.error) {
        const quarterlyMap = new Map()
        
        quarterlyResult.data.forEach((row: {
          data_quarter: string;
          payment_determination_outcome: string;
          provider_offer_pct_qpa?: number;
          prevailing_party_offer_pct_qpa?: number;
        }) => {
          const quarter = row.data_quarter
          if (!quarterlyMap.has(quarter)) {
            quarterlyMap.set(quarter, {
              data_quarter: quarter,
              total_disputes: 0,
              wins: 0,
              losses: 0,
              provider_offers: [],
              winning_offers: []
            })
          }
          
          const entry = quarterlyMap.get(quarter)
          entry.total_disputes++
          
          if (row.payment_determination_outcome === 'In Favor of Provider/Facility/AA Provider') {
            entry.wins++
          } else {
            entry.losses++
          }
          
          if (row.provider_offer_pct_qpa) entry.provider_offers.push(row.provider_offer_pct_qpa)
          if (row.prevailing_party_offer_pct_qpa) entry.winning_offers.push(row.prevailing_party_offer_pct_qpa)
        })

        analyticsData.quarterly_analysis = Array.from(quarterlyMap.values())
          .map(entry => ({
            data_quarter: entry.data_quarter,
            total_disputes: entry.total_disputes,
            wins: entry.wins,
            losses: entry.losses,
            win_rate: entry.total_disputes > 0 ? Math.round((entry.wins / entry.total_disputes) * 100 * 10) / 10 : 0,
            avg_provider_offer_pct: entry.provider_offers.length > 0 
              ? Math.round((entry.provider_offers.reduce((a: number, b: number) => a + b, 0) / entry.provider_offers.length) * 10) / 10 
              : null,
            avg_winning_offer_pct: entry.winning_offers.length > 0 
              ? Math.round((entry.winning_offers.reduce((a: number, b: number) => a + b, 0) / entry.winning_offers.length) * 10) / 10 
              : null
          }))
          .sort((a, b) => a.data_quarter.localeCompare(b.data_quarter))
      }
      
      } // Close else block for hasSpecificFilter

    } catch (analyticsError) {
      console.error('Analytics processing error:', analyticsError)
      // Don't fail the whole request if analytics fails
      analyticsData = { error: 'Analytics data unavailable' }
    }

    return NextResponse.json({ 
      data: data[0],
      analytics: analyticsData
    })

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
        .limit(100000) // Much higher limit to ensure we get all data

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
