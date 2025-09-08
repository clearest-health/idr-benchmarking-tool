'use client'

import { useState, useEffect } from 'react'
import { BenchmarkingService } from '@/lib/benchmarking'
import { BenchmarkMetrics, BenchmarkFilters } from '@/lib/supabase'
import { 
  ChartBarIcon, 
  MapPinIcon, 
  BuildingOfficeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface FilterOptions {
  specialties: string[]
  states: Array<{
    code: string
    name: string
    display: string
  }>
  practice_sizes: string[]
  top_service_codes: Array<{
    service_code: string
    description: string
    dispute_count: number
    provider_win_rate: number
  }>
  metadata?: {
    quarter?: string
    specialty_filter?: string
    state_filter?: string
    total_specialties?: number
    total_service_codes?: number
  }
}

interface Insight {
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
}

export default function BenchmarkingDashboard() {
  const [filters, setFilters] = useState<BenchmarkFilters>({
    quarter: '2024-Q4'
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    specialties: [],
    states: [],
    practice_sizes: [],
    top_service_codes: []
  })
  const [providerMetrics, setProviderMetrics] = useState<BenchmarkMetrics | null>(null)
  const [peerMetrics, setPeerMetrics] = useState<BenchmarkMetrics | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [filtersLoading, setFiltersLoading] = useState(true)
  const [filtersError, setFiltersError] = useState<string | null>(null)
  const [practiceName, setPracticeName] = useState('Your Practice')
  const [serviceCodeSearch, setServiceCodeSearch] = useState('')
  const [showAllServiceCodes, setShowAllServiceCodes] = useState(false)

  // Load filter options on component mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setFiltersLoading(true)
        setFiltersError(null)
        const options = await BenchmarkingService.getFilterOptions({ quarter: filters.quarter })
        setFilterOptions(options)
      } catch (error) {
        console.error('Failed to load filter options:', error)
        setFiltersError('Failed to load filter options. Please refresh the page.')
      } finally {
        setFiltersLoading(false)
      }
    }
    loadFilterOptions()
  }, [filters.quarter])

  // Dynamic filter loading when specialty or state changes
  useEffect(() => {
    if (!filters.specialty && !filters.state) return

    const loadDynamicFilters = async () => {
      try {
        const options = await BenchmarkingService.getFilterOptions({
          specialty: filters.specialty,
          state: filters.state,
          quarter: filters.quarter
        })
        setFilterOptions(prev => ({
          ...prev,
          top_service_codes: options.top_service_codes,
          metadata: options.metadata
        }))
      } catch (error) {
        console.error('Failed to load dynamic filters:', error)
      }
    }

    const debounceTimer = setTimeout(loadDynamicFilters, 300)
    return () => clearTimeout(debounceTimer)
  }, [filters.specialty, filters.state, filters.quarter])

  const runBenchmarkAnalysis = async () => {
    if (!filters.specialty) {
      alert('Please select a specialty to run the analysis')
      return
    }

    setLoading(true)
    try {
      const [providerData, peerData] = await Promise.all([
        BenchmarkingService.getProviderBenchmark(filters),
        BenchmarkingService.getPeerBenchmark(filters)
      ])

      if (!providerData || !peerData) {
        alert('No data found matching your criteria. Please adjust your filters.')
        return
      }

      if (providerData.total_disputes === 0) {
        alert('No disputes found matching your specific criteria. Please broaden your filters.')
        return
      }

      setProviderMetrics(providerData)
      setPeerMetrics(peerData)
      
      // Generate insights
      const generatedInsights = BenchmarkingService.generateInsights(providerData, peerData)
      setInsights(generatedInsights)

    } catch (error) {
      console.error('Error running benchmark analysis:', error)
      alert('Error running analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const chartData = providerMetrics && peerMetrics ? [
    {
      name: 'Win Rate (%)',
      'Your Practice': providerMetrics.provider_win_rate,
      'Peer Average': peerMetrics.provider_win_rate
    },
    {
      name: 'Avg Offer (% QPA)',
      'Your Practice': providerMetrics.avg_provider_offer_pct || 0,
      'Peer Average': peerMetrics.avg_provider_offer_pct || 0
    },
    {
      name: 'Resolution Days',
      'Your Practice': providerMetrics.median_resolution_days || 0,
      'Peer Average': peerMetrics.median_resolution_days || 0
    }
  ] : []

  const COLORS = ['#2E8B57', '#4682B4']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ChartBarIcon className="h-8 w-8 text-green-600 mr-3" />
              IDR Benchmarking Tool
            </h1>
            <p className="mt-2 text-gray-600">
              Compare your IDR performance against peer providers
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar - Filters */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                🎯 Define Your Practice Profile
              </h2>
              
              {filtersError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600 font-medium">⚠️ Configuration Issue</p>
                  <p className="text-sm text-red-600 mt-1">{filtersError}</p>
                  {filtersError.includes('Database not configured') && (
                    <div className="mt-2 text-xs text-red-500">
                      <p>To fix this:</p>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li>Create <code className="bg-red-100 px-1 rounded">.env.local</code> file in the app directory</li>
                        <li>Add your Supabase URL and anon key</li>
                        <li>Restart the development server</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
              
              {/* Practice Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Name
                </label>
                <input
                  type="text"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Your Practice"
                />
              </div>

              {/* Specialty */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Specialty *
                </label>
                <select
                  value={filters.specialty || ''}
                  onChange={(e) => setFilters({...filters, specialty: e.target.value})}
                  disabled={filtersLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {filtersLoading ? 'Loading specialties...' : 'Select Specialty'}
                  </option>
                  {filterOptions.specialties.slice(0, 50).map(specialty => (
                    <option key={specialty} value={specialty}>
                      {specialty.length > 40 ? `${specialty.substring(0, 40)}...` : specialty}
                    </option>
                  ))}
                </select>
                {filterOptions.metadata?.total_specialties && (
                  <p className="text-xs text-gray-500 mt-1">
                    {filterOptions.metadata.total_specialties} specialties available
                    {filterOptions.metadata?.using_sample_data && (
                      <span className="text-orange-600 ml-1">(sample data - database empty)</span>
                    )}
                  </p>
                )}
              </div>

              {/* State */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPinIcon className="h-4 w-4 inline mr-1" />
                  Geographic Location
                </label>
                <select
                  value={filters.state || ''}
                  onChange={(e) => setFilters({...filters, state: e.target.value})}
                  disabled={filtersLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {filtersLoading ? 'Loading states...' : 'All States'}
                  </option>
                  {filterOptions.states.map(state => (
                    <option key={state.code} value={state.code}>
                      {state.display}
                    </option>
                  ))}
                </select>
              </div>

              {/* Practice Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <BuildingOfficeIcon className="h-4 w-4 inline mr-1" />
                  Practice Size
                </label>
                <select
                  value={filters.practice_size || ''}
                  onChange={(e) => setFilters({...filters, practice_size: e.target.value})}
                  disabled={filtersLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {filtersLoading ? 'Loading sizes...' : 'All Sizes'}
                  </option>
                  {filterOptions.practice_sizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              {/* Service Codes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Procedures (Optional)
                  {filters.specialty && (
                    <span className="text-green-600 text-xs ml-1">
                      (filtered by {filters.specialty.substring(0, 20)}...)
                    </span>
                  )}
                </label>
                
                {/* Search box for service codes */}
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Search procedures..."
                    value={serviceCodeSearch}
                    onChange={(e) => setServiceCodeSearch(e.target.value)}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                {/* Selected service codes display */}
                {filters.service_codes && filters.service_codes.length > 0 && (
                  <div className="mb-2 p-2 bg-green-50 rounded-md">
                    <p className="text-xs text-green-700 mb-1">Selected procedures:</p>
                    <div className="flex flex-wrap gap-1">
                      {filters.service_codes.map(code => (
                        <span
                          key={code}
                          className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded"
                        >
                          {code}
                          <button
                            onClick={() => {
                              const updated = filters.service_codes?.filter(c => c !== code) || []
                              setFilters({...filters, service_codes: updated})
                            }}
                            className="ml-1 hover:text-green-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <select
                  multiple
                  value={filters.service_codes || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    setFilters({...filters, service_codes: selected})
                  }}
                  disabled={filtersLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 h-32 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                >
                  {filterOptions.top_service_codes
                    .filter(code => 
                      !serviceCodeSearch || 
                      code.service_code.toLowerCase().includes(serviceCodeSearch.toLowerCase()) ||
                      code.description?.toLowerCase().includes(serviceCodeSearch.toLowerCase())
                    )
                    .slice(0, showAllServiceCodes ? 100 : 30)
                    .map(code => (
                      <option key={code.service_code} value={code.service_code}>
                        {code.service_code} - {code.description?.substring(0, 30)}... 
                        (Win: {code.provider_win_rate?.toFixed(0)}%, Cases: {code.dispute_count})
                      </option>
                    ))
                  }
                </select>
                
                <div className="text-xs text-gray-500 mt-1 space-y-1">
                  <p>Hold Ctrl/Cmd to select multiple</p>
                  {filterOptions.metadata?.total_service_codes && (
                    <div className="flex justify-between items-center">
                      <span>
                        Showing {Math.min(showAllServiceCodes ? 100 : 30, filterOptions.metadata.total_service_codes)} of {filterOptions.metadata.total_service_codes} procedures
                      </span>
                      {filterOptions.metadata.total_service_codes > 30 && (
                        <button
                          onClick={() => setShowAllServiceCodes(!showAllServiceCodes)}
                          className="text-green-600 hover:text-green-700 underline"
                        >
                          {showAllServiceCodes ? 'Show Less' : 'Show More'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Run Analysis Button */}
              <button
                onClick={runBenchmarkAnalysis}
                disabled={loading || !filters.specialty}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Analyzing...' : '🚀 Run Benchmarking Analysis'}
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {!providerMetrics ? (
              // Welcome State
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <TrophyIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to IDR Benchmarking
                </h2>
                <div className="max-w-2xl mx-auto text-gray-600 space-y-4">
                  <p className="text-lg">
                    We've been studying IDR outcomes and have identified patterns in why some groups lose or waste money in arbitration.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">📊 Compare Performance</h3>
                      <p className="text-blue-700 text-sm">See how your win rates stack up against similar providers</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-900 mb-2">💰 Optimize Offers</h3>
                      <p className="text-green-700 text-sm">Identify opportunities where you may be leaving money on the table</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-purple-900 mb-2">🎯 Strategic Insights</h3>
                      <p className="text-purple-700 text-sm">Make data-driven decisions about which claims to pursue</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-orange-900 mb-2">⏱️ Save Time</h3>
                      <p className="text-orange-700 text-sm">Understand what works for high-performing peers</p>
                    </div>
                  </div>
                  <p className="text-green-600 font-medium mt-6">
                    👈 Get started by selecting your practice profile in the sidebar
                  </p>
                </div>
              </div>
            ) : (
              // Results State
              <div className="space-y-6">
                {/* Performance Summary */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    📊 Performance Summary: {practiceName}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <TrophyIcon className="h-8 w-8 text-green-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-900">Win Rate</p>
                          <p className="text-2xl font-bold text-green-600">
                            {providerMetrics.provider_win_rate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-green-700">
                            {peerMetrics && (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate) > 0 ? '+' : ''}
                            {peerMetrics ? (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate).toFixed(1) : '0.0'}pp vs peers
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="h-8 w-8 text-blue-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-900">Avg Offer</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {providerMetrics.avg_provider_offer_pct?.toFixed(0) || 'N/A'}%
                          </p>
                          <p className="text-xs text-blue-700">QPA</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <ClockIcon className="h-8 w-8 text-purple-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-purple-900">Resolution</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {providerMetrics.median_resolution_days?.toFixed(0) || 'N/A'}
                          </p>
                          <p className="text-xs text-purple-700">days</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <ChartBarIcon className="h-8 w-8 text-orange-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-orange-900">Disputes</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {providerMetrics.total_disputes.toLocaleString()}
                          </p>
                          <p className="text-xs text-orange-700">analyzed</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📈 Performance Comparison
                  </h3>
                  
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="Your Practice" fill="#2E8B57" />
                        <Bar dataKey="Peer Average" fill="#4682B4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Insights */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    💡 Key Insights & Recommendations
                  </h3>
                  
                  <div className="space-y-4">
                    {insights.map((insight, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${
                          insight.type === 'success' 
                            ? 'bg-green-50 border-green-400' 
                            : insight.type === 'warning'
                            ? 'bg-yellow-50 border-yellow-400'
                            : 'bg-blue-50 border-blue-400'
                        }`}
                      >
                        <h4 className="font-semibold mb-2">{insight.title}</h4>
                        <p className="text-sm">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analysis Parameters */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    🎯 Analysis Parameters
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Your Practice Profile:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Specialty: {filters.specialty}</li>
                        <li>• Location: {filters.state || 'All States'}</li>
                        <li>• Size: {filters.practice_size || 'All Sizes'}</li>
                        {filters.service_codes && filters.service_codes.length > 0 && (
                          <li>• Service Codes: {filters.service_codes.slice(0, 3).join(', ')}{filters.service_codes.length > 3 ? '...' : ''}</li>
                        )}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Peer Comparison Group:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Same specialty: {filters.specialty}</li>
                        <li>• All locations (broader scope)</li>
                        <li>• All practice sizes</li>
                        <li>• Total peer disputes: {peerMetrics?.total_disputes.toLocaleString() || '0'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
