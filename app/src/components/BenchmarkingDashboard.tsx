'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { BenchmarkingService } from '@/lib/benchmarking'
import { BenchmarkMetrics, BenchmarkFilters } from '@/lib/supabase'
import { usePostHog } from 'posthog-js/react'
import { 
  Container,
  Grid,
  Paper,
  Title,
  Text,
  Select,
  Button,
  Card,
  Group,
  Stack,
  Badge,
  Loader,
  Alert,
  Box,
  Autocomplete,
  Table
} from '@mantine/core'
import { 
  IconChartBar, 
  IconBuilding,
  IconClock,
  IconCurrencyDollar,
  IconTrophy,
  IconAlertCircle
} from '@tabler/icons-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  metadata?: {
    quarter?: string
    specialty_filter?: string
    state_filter?: string
    total_specialties?: number
    using_sample_data?: boolean
  }
}

interface PracticeSearchResult {
  name: string
  specialty: string
  location: string
  size: string
}

interface EmailDomainResult {
  domain: string
}

interface FacilityGroupResult {
  name: string
}

interface Insight {
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
}

export default function BenchmarkingDashboard() {
  const posthog = usePostHog()
  
  // Add CSS for button animation
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes breathe {
        0% {
          transform: scale(1);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
        50% {
          transform: scale(1.08);
          box-shadow: 0 15px 40px rgba(16, 185, 129, 0.8);
        }
        100% {
          transform: scale(1);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
      }
      .breathe-animation {
        animation: breathe 1.5s ease-in-out infinite;
      }
      .breathe-animation:hover {
        animation: none !important;
        transform: scale(1.08) !important;
        box-shadow: 0 15px 40px rgba(16, 185, 129, 0.8) !important;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])
  
  const [filters, setFilters] = useState<BenchmarkFilters>({
    quarter: '2024-Q4',
    user_type: 'individual_provider'
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    specialties: [],
    states: [],
    practice_sizes: []
  })
  const [providerMetrics, setProviderMetrics] = useState<BenchmarkMetrics | null>(null)
  const [peerMetrics, setPeerMetrics] = useState<BenchmarkMetrics | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [filtersLoading, setFiltersLoading] = useState(true)
  const [filtersError, setFiltersError] = useState<string | null>(null)
  const [practiceName, setPracticeName] = useState('')
  const [emailDomain, setEmailDomain] = useState('')
  const [facilityGroup, setFacilityGroup] = useState('')
  const [practiceNameSuggestions, setPracticeNameSuggestions] = useState<string[]>([])
  const [practiceNameLoading, setPracticeNameLoading] = useState(false)
  const [emailDomainSuggestions, setEmailDomainSuggestions] = useState<string[]>([])
  const [emailDomainLoading, setEmailDomainLoading] = useState(false)
  const [facilityGroupSuggestions, setFacilityGroupSuggestions] = useState<string[]>([])
  const [facilityGroupLoading, setFacilityGroupLoading] = useState(false)
  const [practiceData, setPracticeData] = useState<Array<{
    name: string
    specialty: string
    location: string
    size: string
    disputeCount: number
    displayName: string
  }>>([])
  const [selectedPractice, setSelectedPractice] = useState<{
    name: string
    specialty: string
    location: string
    size: string
  } | null>(null)

  // Load URL parameters on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlUserType = urlParams.get('user_type')
      const urlPracticeName = urlParams.get('practice_name')
      const urlEmailDomain = urlParams.get('email_domain')
      const urlFacilityGroup = urlParams.get('facility_group')
      const urlSpecialty = urlParams.get('specialty')
      const urlState = urlParams.get('state')
      const urlPracticeSize = urlParams.get('practice_size')
      const urlQuarter = urlParams.get('quarter')

      // Set user type if provided
      if (urlUserType && ['individual_provider', 'law_firm', 'provider_group'].includes(urlUserType)) {
        setFilters(prev => ({
          ...prev,
          user_type: urlUserType as 'individual_provider' | 'provider_group' | 'law_firm'
        }))
      }

      // Handle practice name for individual providers
      if (urlPracticeName) {
        setPracticeName(urlPracticeName)
        // Trigger search to get practice data and auto-populate fields
        setTimeout(() => searchPracticeNames(urlPracticeName), 100)
      }

      // Handle email domain for law firms
      if (urlEmailDomain) {
        setEmailDomain(urlEmailDomain)
        // Trigger search for email domain suggestions
        setTimeout(() => searchEmailDomains(urlEmailDomain), 100)
      }

      // Handle facility group for provider groups
      if (urlFacilityGroup) {
        setFacilityGroup(urlFacilityGroup)
        // Trigger search for facility group suggestions
        setTimeout(() => searchFacilityGroups(urlFacilityGroup), 100)
      }
      
      setFilters(prev => ({
        ...prev,
        specialty: urlSpecialty || prev.specialty,
        state: urlState || prev.state,
        practice_size: urlPracticeSize || prev.practice_size,
        quarter: urlQuarter || prev.quarter
      }))
    }
  }, [])


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

  // Search for practice names
  const searchPracticeNames = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setPracticeNameSuggestions([])
      setPracticeData([])
      return
    }

    try {
      setPracticeNameLoading(true)
      const params = new URLSearchParams({
        q: query,
        limit: '10'
      })
      
      if (filters.specialty) {
        params.append('specialty', filters.specialty)
      }

      const response = await fetch(`/api/practice-search?${params.toString()}`)
      const data = await response.json()

      if (data.practices) {
        setPracticeData(data.practices)
        setPracticeNameSuggestions(data.practices.map((p: PracticeSearchResult) => p.name))
      }
    } catch (error) {
      console.error('Error searching practice names:', error)
    } finally {
      setPracticeNameLoading(false)
    }
  }, [filters.specialty])

  // Handle practice selection and auto-populate fields
  const handlePracticeSelection = useCallback((selectedPracticeName: string) => {
    const practice = practiceData.find(p => p.name === selectedPracticeName)
    if (practice) {
      setSelectedPractice({
        name: practice.name,
        specialty: practice.specialty,
        location: practice.location,
        size: practice.size
      })

      // Auto-populate the form fields with exact matching
      const matchedSpecialty = filterOptions.specialties.find(s => 
        s.toLowerCase() === practice.specialty.toLowerCase()
      ) || practice.specialty

      const matchedState = filterOptions.states.find(s => 
        s.code === practice.location || s.name.toLowerCase() === practice.location.toLowerCase()
      )?.code || practice.location

      const matchedSize = filterOptions.practice_sizes.find(s => 
        s.toLowerCase() === practice.size.toLowerCase()
      ) || practice.size

      setFilters(prev => ({
        ...prev,
        specialty: matchedSpecialty,
        state: matchedState,
        practice_size: matchedSize
      }))

      // Track practice selection
      posthog?.capture('practice_selected', {
        practice_name: practice.name,
        specialty: practice.specialty,
        location: practice.location,
        size: practice.size,
        dispute_count: practice.disputeCount
      })
    }
  }, [practiceData, filterOptions.specialties, filterOptions.states, filterOptions.practice_sizes, posthog])

  // Auto-select practice when search results come back (for URL parameters)
  useEffect(() => {
    if (practiceData.length > 0 && practiceName && !selectedPractice && filterOptions.specialties.length > 0) {
      const exactMatch = practiceData.find(p => p.name.toLowerCase() === practiceName.toLowerCase())
      if (exactMatch) {
        handlePracticeSelection(exactMatch.name)
      }
    }
  }, [practiceData, practiceName, selectedPractice, filterOptions.specialties, handlePracticeSelection])

  // Search for email domains
  const searchEmailDomains = async (query: string) => {
    if (!query || query.length < 2) {
      setEmailDomainSuggestions([])
      return
    }

    try {
      setEmailDomainLoading(true)
      const response = await fetch(`/api/email-domain-search?q=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()

      if (data.domains) {
        setEmailDomainSuggestions(data.domains.map((d: EmailDomainResult) => d.domain))
      }
    } catch (error) {
      console.error('Error searching email domains:', error)
    } finally {
      setEmailDomainLoading(false)
    }
  }

  // Search for facility groups
  const searchFacilityGroups = async (query: string) => {
    if (!query || query.length < 2) {
      setFacilityGroupSuggestions([])
      return
    }

    try {
      setFacilityGroupLoading(true)
      const response = await fetch(`/api/facility-group-search?q=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()

      if (data.groups) {
        setFacilityGroupSuggestions(data.groups.map((g: FacilityGroupResult) => g.name))
      }
    } catch (error) {
      console.error('Error searching facility groups:', error)
    } finally {
      setFacilityGroupLoading(false)
    }
  }

  const runBenchmarkAnalysis = async () => {
    // Validation based on user type
    if (filters.user_type === 'individual_provider' && !filters.specialty) {
      alert('Please select a specialty to run the analysis')
      return
    }
    
    if (filters.user_type === 'law_firm' && !emailDomain.trim()) {
      alert('Please enter your law firm email domain to run the analysis')
      return
    }
    
    if (filters.user_type === 'provider_group' && !facilityGroup.trim()) {
      alert('Please enter your provider group name to run the analysis')
      return
    }

    // Track analysis start
    posthog?.capture('analysis_started', {
      specialty: filters.specialty,
      state: filters.state,
      practice_size: filters.practice_size,
      practice_name: practiceName.trim() || null,
      quarter: filters.quarter
    })

    setLoading(true)
    try {
      // Include appropriate identifier based on user type
      const providerFilters = {
        ...filters,
        practice_name: filters.user_type === 'individual_provider' ? (practiceName.trim() || undefined) : undefined,
        email_domain: filters.user_type === 'law_firm' ? (emailDomain.trim() || undefined) : undefined,
        facility_group: filters.user_type === 'provider_group' ? (facilityGroup.trim() || undefined) : undefined
      }

      const [providerData, peerData] = await Promise.all([
        BenchmarkingService.getProviderBenchmark(providerFilters),
        BenchmarkingService.getPeerBenchmark(filters) // Keep peer comparison broad (no practice name filter)
      ])

      if (!providerData || !peerData) {
        posthog?.capture('analysis_failed', { reason: 'no_data_found' })
        alert('No data found matching your criteria. Please adjust your filters.')
        return
      }

      if (providerData.total_disputes === 0) {
        posthog?.capture('analysis_failed', { reason: 'zero_disputes' })
        alert('No disputes found matching your specific criteria. Please broaden your filters.')
        return
      }

      setProviderMetrics(providerData)
      setPeerMetrics(peerData)
      
      // Generate insights based on user type
      const generatedInsights = BenchmarkingService.generateInsights(
        providerData, 
        peerData, 
        filters.user_type || 'individual_provider'
      )
      setInsights(generatedInsights)

      // Track successful analysis
      posthog?.capture('analysis_completed', {
        specialty: filters.specialty,
        state: filters.state,
        practice_size: filters.practice_size,
        practice_name: practiceName.trim() || null,
        total_disputes: providerData.total_disputes,
        win_rate: providerData.provider_win_rate,
        insights_generated: generatedInsights.length
      })

    } catch (error) {
      console.error('Error running benchmark analysis:', error)
      posthog?.capture('analysis_error', { error: String(error) })
      alert('Error running analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Separate chart data for each metric
  const winRateData = providerMetrics && peerMetrics ? [
    {
      name: 'Your Practice',
      value: providerMetrics.provider_win_rate
    },
    {
      name: 'Peer Average',
      value: peerMetrics.provider_win_rate
    }
  ] : []

  const offerData = providerMetrics && peerMetrics ? [
    {
      name: 'Your Practice',
      value: providerMetrics.avg_provider_offer_pct || 0
    },
    {
      name: 'Peer Average',
      value: peerMetrics.avg_provider_offer_pct || 0
    }
  ] : []

  const resolutionData = providerMetrics && peerMetrics ? [
    {
      name: 'Your Practice',
      value: providerMetrics.median_resolution_days || 0
    },
    {
      name: 'Peer Average',
      value: peerMetrics.median_resolution_days || 0
    }
  ] : []

  // Consistent colors across all charts
  const PRACTICE_COLOR = '#2E8B57' // Green for Your Practice
  const PEER_COLOR = '#4682B4'     // Blue for Peer Average

  return (
    <Box bg="gray.0" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper shadow="sm" mb="lg">
        <Container size="xl" py="xl">
          <Group align="center">
            <div>
              <Title order={1} size="h1" c="gray.9">
                🎯 Get Your IDR Performance Analysis
              </Title>
              <Text size="sm" c="gray.6" mt={4}>
              Compare your IDR performance against peer providers
              </Text>
          </div>
          </Group>
        </Container>
      </Paper>

      {/* Main Content - Flex grow to push footer down */}
      <Box style={{ flex: 1 }}>
        <Container size="xl" py="lg">
          {/* Horizontal Form Layout */}
          <Stack gap="xl">
            <Paper shadow="lg" p="xl" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: '2px solid #e2e8f0' }}>
              <Grid gutter="xl" align="end">
                {/* Step 1: User Type */}
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Box>
                    <Group mb="sm">
                      <Box 
                        style={{ 
                          background: '#8b5cf6', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        1
                      </Box>
                      <Title order={4} c="violet.7" size="md">Your Role</Title>
                    </Group>

                    <Select
                      value={filters.user_type || 'individual_provider'}
                      onChange={(value) => {
                        setFilters({
                          ...filters, 
                          user_type: value as 'individual_provider' | 'provider_group' | 'law_firm'
                        })
                        // Clear relevant fields when switching types
                        setPracticeName('')
                        setEmailDomain('')
                        setFacilityGroup('')
                        setSelectedPractice(null)
                        // Clear analysis results to show welcome screen
                        setProviderMetrics(null)
                        setPeerMetrics(null)
                        setInsights([])
                      }}
                      data={[
                        { value: 'individual_provider', label: '🏥 Provider/Practice' },
                        { value: 'provider_group', label: '🏢 Provider Group' },
                        { value: 'law_firm', label: '⚖️ Law Firm' }
                      ]}
                      size="lg"
                      styles={{
                        input: { 
                          borderWidth: '2px',
                          fontSize: '16px',
                          '&:focus': { borderColor: '#8b5cf6', boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.2)' }
                        }
                      }}
                    />
                  </Box>
                </Grid.Col>

                {/* Step 2: Entity Identification */}
                <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                  <Box>
                    <Group mb="sm">
                      <Box 
                        style={{ 
                          background: '#10b981', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        2
                      </Box>
                      <Title order={4} c="green.7" size="md">
                        {filters.user_type === 'law_firm' ? 'Email Domain' :
                         filters.user_type === 'provider_group' ? 'Group Name' :
                         'Practice Name'}
                      </Title>
                    </Group>

                    {/* Dynamic Input Fields */}
                    {filters.user_type === 'individual_provider' && (
                      <Autocomplete
                        value={practiceName}
                        onChange={(value) => {
                          setPracticeName(value)
                          if (practiceNameSuggestions.includes(value)) {
                            handlePracticeSelection(value)
                          }
                          if (value && value.length >= 2) {
                            setTimeout(() => searchPracticeNames(value), 300)
                          } else {
                            setPracticeNameSuggestions([])
                            setPracticeData([])
                            setSelectedPractice(null)
                          }
                        }}
                        data={practiceNameSuggestions}
                        placeholder="Type practice name..."
                        size="lg"
                        rightSection={practiceNameLoading ? <Loader size="xs" /> : undefined}
                        styles={{
                          input: { 
                            borderWidth: '2px',
                            fontSize: '16px',
                            '&:focus': { borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }
                          }
                        }}
                      />
                    )}

                    {filters.user_type === 'law_firm' && (
                      <Autocomplete
                        value={emailDomain}
                        onChange={(value) => {
                          setEmailDomain(value)
                          if (value && value.length >= 2) {
                            setTimeout(() => searchEmailDomains(value), 300)
                          } else {
                            setEmailDomainSuggestions([])
                          }
                        }}
                        data={emailDomainSuggestions}
                        placeholder="Type email domain..."
                        size="lg"
                        rightSection={emailDomainLoading ? <Loader size="xs" /> : undefined}
                        styles={{
                          input: { 
                            borderWidth: '2px',
                            fontSize: '16px',
                            '&:focus': { borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }
                          }
                        }}
                      />
                    )}

                    {filters.user_type === 'provider_group' && (
                      <Autocomplete
                        value={facilityGroup}
                        onChange={(value) => {
                          setFacilityGroup(value)
                          if (value && value.length >= 2) {
                            setTimeout(() => searchFacilityGroups(value), 300)
                          } else {
                            setFacilityGroupSuggestions([])
                          }
                        }}
                        data={facilityGroupSuggestions}
                        placeholder="Type group name..."
                        size="lg"
                        rightSection={facilityGroupLoading ? <Loader size="xs" /> : undefined}
                        styles={{
                          input: { 
                            borderWidth: '2px',
                            fontSize: '16px',
                            '&:focus': { borderColor: '#10b981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }
                          }
                        }}
                      />
                    )}
                  </Box>
                </Grid.Col>

                {/* Step 3: Specialty Filter */}
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Box>
                    <Group mb="sm">
                      <Box 
                        style={{ 
                          background: '#f59e0b', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                      >
                        3
                      </Box>
                      <Title order={4} c="yellow.7" size="md">
                        {filters.user_type === 'individual_provider' ? 'Specialty *' : 'Focus (Optional)'}
                      </Title>
                    </Group>

                    <Select
                      value={filters.specialty || null}
                      onChange={(value) => setFilters({...filters, specialty: value || undefined})}
                      disabled={filtersLoading}
                      placeholder={filters.user_type === 'individual_provider' ? 'Select specialty' : 'All specialties'}
                      data={filterOptions.specialties.map(specialty => ({
                        value: specialty,
                        label: specialty.length > 30 ? `${specialty.substring(0, 30)}...` : specialty
                      }))}
                      searchable
                      clearable
                      size="lg"
                      styles={{
                        input: { 
                          borderWidth: '2px',
                          fontSize: '16px',
                          '&:focus': { borderColor: '#f59e0b', boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.2)' }
                        }
                      }}
                    />
                  </Box>
                </Grid.Col>

                {/* Step 4: Run Analysis Button */}
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <Button
                    onClick={runBenchmarkAnalysis}
                    disabled={loading || (
                      filters.user_type === 'individual_provider' && !filters.specialty
                    ) || (
                      filters.user_type === 'law_firm' && !emailDomain.trim()
                    ) || (
                      filters.user_type === 'provider_group' && !facilityGroup.trim()
                    )}
                    loading={loading}
                    size="xl"
                    fullWidth
                    h={80}
                    className={!providerMetrics && !loading && !(
                      (filters.user_type === 'individual_provider' && !filters.specialty) ||
                      (filters.user_type === 'law_firm' && !emailDomain.trim()) ||
                      (filters.user_type === 'provider_group' && !facilityGroup.trim())
                    ) ? 'breathe-animation' : ''}
                    styles={{
                      root: {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        borderRadius: '12px',
                        border: '3px solid #065f46',
                        boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                        '&:hover': {
                          transform: 'scale(1.08)',
                          boxShadow: '0 15px 40px rgba(16, 185, 129, 0.8)'
                        },
                        '&:disabled': {
                          background: '#9ca3af',
                          transform: 'none',
                          boxShadow: 'none'
                        }
                      }
                    }}
                  >
                    {loading ? (
                      <Stack gap="xs" align="center">
                        <Loader size="sm" color="white" />
                        <Text size="sm" c="white">Analyzing...</Text>
                      </Stack>
                    ) : (
                      <Stack gap="xs" align="center">
                        <Text size="sm" fw="bold" c="white">RUN ANALYSIS</Text>
                      </Stack>
                    )}
                  </Button>
                </Grid.Col>
              </Grid>
            </Paper>
              
              {filtersError && (
                <Alert 
                  icon={<IconAlertCircle size="1rem" />} 
                  title="⚠️ Configuration Issue" 
                  color="red" 
                  mb="md"
                >
                  <Text size="sm">{filtersError}</Text>
                  {filtersError.includes('Database not configured') && (
                    <Box mt="xs">
                      <Text size="xs" c="red">To fix this:</Text>
                      <Text size="xs" c="red" component="ol" style={{ listStyleType: 'decimal', paddingLeft: '1rem' }}>
                        <li>Create <code style={{ backgroundColor: 'var(--mantine-color-red-1)', padding: '2px 4px', borderRadius: '4px' }}>.env.local</code> file in the app directory</li>
                        <li>Add your Supabase URL and anon key</li>
                        <li>Restart the development server</li>
                      </Text>
                    </Box>
                  )}
                </Alert>
              )}

            {/* Optional Filters - Below main form */}
            {(filters.specialty || filters.state || filters.practice_size) && (
              <Paper p="lg" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24', borderRadius: '8px' }}>
                <Title order={5} c="yellow.8" mb="xs">Active Filters:</Title>
                <Group gap="sm">
                  {filters.specialty && <Badge color="yellow" variant="light">{filters.specialty}</Badge>}
                  {filters.state && <Badge color="yellow" variant="light">{filters.state}</Badge>}
                  {filters.practice_size && <Badge color="yellow" variant="light">{filters.practice_size}</Badge>}
                </Group>
              </Paper>
            )}

            {/* Main Content */}
            {!providerMetrics ? (
              // Welcome State
              <Paper shadow="sm" p="xl" ta="center">
                <IconTrophy size={64} color="var(--mantine-color-green-6)" style={{ margin: '0 auto 1rem' }} />
                <Title order={2} size="h2" c="gray.9" mb="md">
                  Welcome to IDR Benchmarking
                </Title>
                <Box maw={800} mx="auto" c="gray.6">
                  <Text size="lg" mb="xl">
                    We&apos;ve been studying IDR outcomes and have identified patterns in why some groups lose or waste money in arbitration.
                  </Text>
                  <Grid mt="xl">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Card bg="blue.0" p="md">
                        <Title order={3} size="md" c="blue.9" mb="xs">📊 Compare Performance</Title>
                        <Text size="sm" c="blue.7">See how your win rates stack up against similar providers</Text>
                      </Card>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Card bg="green.0" p="md">
                        <Title order={3} size="md" c="green.9" mb="xs">💰 Optimize Offers</Title>
                        <Text size="sm" c="green.7">Identify opportunities where you may be leaving money on the table</Text>
                      </Card>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Card bg="violet.0" p="md">
                        <Title order={3} size="md" c="violet.9" mb="xs">🎯 Strategic Insights</Title>
                        <Text size="sm" c="violet.7">Make data-driven decisions about which claims to pursue</Text>
                      </Card>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Card bg="orange.0" p="md">
                        <Title order={3} size="md" c="orange.9" mb="xs">⏱️ Save Time</Title>
                        <Text size="sm" c="orange.7">Understand what works for high-performing peers</Text>
                      </Card>
                    </Grid.Col>
                  </Grid>
                  <Text c="green.6" fw={500} mt="xl">
                    👈 Get started by selecting your practice profile in the sidebar
                  </Text>
                </Box>
              </Paper>
            ) : (
              // Results State
              <Stack gap="lg">
                {/* Performance Summary */}
                <Paper shadow="sm" p="lg">
                  <Title order={2} size="xl" c="gray.9" mb="md">
                    📊 Performance Summary: {
                      filters.user_type === 'law_firm' ? (emailDomain.trim() || 'Your Law Firm') :
                      filters.user_type === 'provider_group' ? (facilityGroup.trim() || 'Your Provider Group') :
                      (practiceName.trim() || 'Your Practice')
                    }
                  </Title>
                  
                  <Grid>
                    {/* Top Row - Win Rate and Average Offer */}
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Card bg="green.0" p={{ base: "sm", sm: "md", md: "lg" }} style={{ minHeight: '100px' }}>
                        <Group align="center" gap="sm">
                          <IconTrophy size={28} color="var(--mantine-color-green-6)" />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500} c="green.9">Win Rate</Text>
                            <Text size="xl" fw={700} c="green.6" style={{ lineHeight: 1.2 }}>
                              {providerMetrics.provider_win_rate.toFixed(1)}%
                            </Text>
                            <Text size="xs" c="green.7" style={{ lineHeight: 1.3 }}>
                              {peerMetrics && (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate) > 0 ? '+' : ''}
                              {peerMetrics ? (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate).toFixed(1) : '0.0'}pp vs peers
                            </Text>
                          </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Card bg="blue.0" p={{ base: "sm", sm: "md", md: "lg" }} style={{ minHeight: '100px' }}>
                        <Group align="center" gap="sm">
                          <IconCurrencyDollar size={28} color="var(--mantine-color-blue-6)" />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500} c="blue.9">Avg Offer</Text>
                            <Text size="xl" fw={700} c="blue.6" style={{ lineHeight: 1.2 }}>
                              {providerMetrics.avg_provider_offer_pct?.toFixed(0) || 'N/A'}%
                            </Text>
                            <Text size="xs" c="blue.7">QPA</Text>
                          </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    {/* Bottom Row - Three cards */}
                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                      <Card bg="violet.0" p={{ base: "sm", md: "md" }} style={{ minHeight: '80px' }}>
                        <Group align="center" gap="sm">
                          <IconClock size={24} color="var(--mantine-color-violet-6)" />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500} c="violet.9">Resolution</Text>
                            <Text size="lg" fw={700} c="violet.6" style={{ lineHeight: 1.2 }}>
                              {providerMetrics.median_resolution_days?.toFixed(0) || 'N/A'}
                            </Text>
                            <Text size="xs" c="violet.7">days</Text>
                          </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                      <Card bg="orange.0" p={{ base: "sm", md: "md" }} style={{ minHeight: '80px' }}>
                        <Group align="center" gap="sm">
                          <IconChartBar size={24} color="var(--mantine-color-orange-6)" />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500} c="orange.9">
                              {filters.user_type === 'law_firm' ? 'Total Disputes' : 
                               filters.user_type === 'provider_group' ? 'Total Disputes' : 'Disputes'}
                            </Text>
                            <Text size="lg" fw={700} c="orange.6" style={{ lineHeight: 1.2 }}>
                              {providerMetrics.total_disputes.toLocaleString()}
                            </Text>
                            <Text size="xs" c="orange.7" style={{ lineHeight: 1.3 }}>
                              {filters.user_type === 'law_firm' ? 'across all clients' :
                               filters.user_type === 'provider_group' ? 'across all facilities' : 'analyzed'}
                            </Text>
                          </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    {/* Additional Metrics for all user types */}
                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                      <Card bg="teal.0" p={{ base: "sm", md: "md" }} style={{ minHeight: '80px' }}>
                        <Group align="center" gap="sm">
                          <IconBuilding size={24} color="var(--mantine-color-teal-6)" />
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500} c="teal.9">
                              {filters.user_type === 'law_firm' ? 'Practices' : 
                               filters.user_type === 'provider_group' ? 'Facilities' : 'Providers'}
                            </Text>
                            <Text size="lg" fw={700} c="teal.6" style={{ lineHeight: 1.2 }}>
                              {filters.user_type === 'law_firm' ? 
                                (providerMetrics.total_practices?.toLocaleString() || '0') :
                                filters.user_type === 'provider_group' ?
                                (providerMetrics.total_facilities?.toLocaleString() || '0') : '1'
                              }
                            </Text>
                            <Text size="xs" c="teal.7" style={{ lineHeight: 1.3 }}>
                              {filters.user_type === 'law_firm' ? 'represented' : 
                               filters.user_type === 'provider_group' ? 'in network' : 'analyzed'}
                            </Text>
                          </div>
                        </Group>
                      </Card>
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Charts */}
                <Paper shadow="sm" p="lg">
                  <Title order={3} size="lg" c="gray.9" mb="md">
                    📈 Performance Comparison
                  </Title>
                  
                  <Grid>
                    {/* Win Rate Chart */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.7" mb="xs" ta="center">
                          Win Rate (%)
                        </Title>
                        <Box h={300}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={winRateData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={14} />
                              <YAxis domain={[0, 100]} fontSize={12} />
                              <Tooltip formatter={(value) => [`${value}%`, 'Win Rate']} />
                              <Bar dataKey="value">
                                {winRateData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? PRACTICE_COLOR : PEER_COLOR} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </Grid.Col>

                    {/* Average Offer Chart */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.7" mb="xs" ta="center">
                          Average Offer (% QPA)
                        </Title>
                        <Box h={300}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={offerData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={14} />
                              <YAxis fontSize={12} />
                              <Tooltip formatter={(value) => [`${value}%`, 'Offer % QPA']} />
                              <Bar dataKey="value">
                                {offerData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? PRACTICE_COLOR : PEER_COLOR} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </Grid.Col>

                    {/* Resolution Time Chart */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.7" mb="xs" ta="center">
                          Resolution Time (Days)
                        </Title>
                        <Box h={300}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={resolutionData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={14} />
                              <YAxis fontSize={12} />
                              <Tooltip formatter={(value) => [`${value}`, 'Days']} />
                              <Bar dataKey="value">
                                {resolutionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? PRACTICE_COLOR : PEER_COLOR} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Insights */}
                <Paper shadow="sm" p="lg">
                  <Title order={3} size="lg" c="gray.9" mb="md">
                    💡 Key Insights & Recommendations
                  </Title>
                  
                  <Stack gap="sm">
                    {insights.map((insight, index) => (
                      <Alert
                        key={index}
                        color={
                          insight.type === 'success' 
                            ? 'green' 
                            : insight.type === 'warning'
                            ? 'yellow'
                            : 'blue'
                        }
                        title={insight.title}
                        variant="light"
                      >
                        <Text size="sm">{insight.message}</Text>
                      </Alert>
                    ))}
                  </Stack>
                </Paper>  

                {/* Analysis Parameters */}
                <Paper shadow="sm" p="lg">
                  <Title order={3} size="lg" c="gray.9" mb="md">
                    🎯 Analysis Parameters
                  </Title>
                  
                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.9" mb="xs">
                          {filters.user_type === 'law_firm' ? 'Your Law Firm Profile:' :
                           filters.user_type === 'provider_group' ? 'Your Provider Group Profile:' :
                           'Your Practice Profile:'}
                        </Title>
                        <Text size="sm" c="gray.6" component="ul" style={{ listStyleType: 'none', padding: 0 }}>
                          {filters.user_type === 'law_firm' && emailDomain.trim() && (
                            <li>• Email Domain: &quot;{emailDomain.trim()}&quot;</li>
                          )}
                          {filters.user_type === 'provider_group' && facilityGroup.trim() && (
                            <li>• Provider Group: &quot;{facilityGroup.trim()}&quot;</li>
                          )}
                          {filters.user_type === 'individual_provider' && practiceName.trim() && (
                            <li>• Practice Name: &quot;{practiceName.trim()}&quot;</li>
                          )}
                          <li>• Focus Specialty: {filters.specialty || 'All Specialties'}</li>
                          <li>• Location: {filters.state || 'All States (not specified)'}</li>
                          {filters.user_type === 'individual_provider' && (
                            <li>• Size: {filters.practice_size || 'All Sizes (not specified)'}</li>
                          )}
                          {filters.user_type === 'individual_provider' && (
                            <li>• Providers: 1</li>
                          )}
                          {(filters.user_type === 'law_firm' || filters.user_type === 'provider_group') && providerMetrics && (
                            <>
                              <li>• {filters.user_type === 'law_firm' ? 'Practices' : 'Facilities'}: {
                                filters.user_type === 'law_firm' ? 
                                  (providerMetrics.total_practices?.toLocaleString() || '0') :
                                  (providerMetrics.total_facilities?.toLocaleString() || '0')
                              }</li>
                              <li>• Specialties: {providerMetrics.specialties_represented || 0}</li>
                              <li>• States: {providerMetrics.states_represented || 0}</li>
                            </>
                          )}
                        </Text>
                      </Box>
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.9" mb="xs">Peer Comparison Group:</Title>
                        <Text size="sm" c="gray.6" component="ul" style={{ listStyleType: 'none', padding: 0 }}>
                          {filters.user_type === 'law_firm' ? (
                            <>
                              <li>• All law firms in IDR market</li>
                              <li>• {filters.specialty ? `Focus: ${filters.specialty}` : 'All specialties'}</li>
                              <li>• All geographic locations</li>
                              <li>• Total peer disputes: {peerMetrics?.total_disputes.toLocaleString() || '0'}</li>
                            </>
                          ) : filters.user_type === 'provider_group' ? (
                            <>
                              <li>• All provider groups/health systems</li>
                              <li>• {filters.specialty ? `Focus: ${filters.specialty}` : 'All specialties'}</li>
                              <li>• All geographic locations</li>
                              <li>• Total peer disputes: {peerMetrics?.total_disputes.toLocaleString() || '0'}</li>
                            </>
                          ) : (
                            <>
                        <li>• Same specialty: {filters.specialty}</li>
                        <li>• All locations (broader scope)</li>
                        <li>• All practice sizes</li>
                        <li>• Total peer disputes: {peerMetrics?.total_disputes.toLocaleString() || '0'}</li>
                            </>
                          )}
                        </Text>
                      </Box>
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Raw Data Table */}
                <Paper shadow="sm" p="lg">
                  <Title order={3} size="lg" c="gray.9" mb="md">
                    📋 Raw Data Summary
                  </Title>
                  
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Metric</Table.Th>
                        <Table.Th ta="center">Your Practice</Table.Th>
                        <Table.Th ta="center">Peer Average</Table.Th>
                        <Table.Th ta="center">Difference</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td fw={500}>Total Disputes</Table.Td>
                        <Table.Td ta="center">{providerMetrics.total_disputes.toLocaleString()}</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.total_disputes.toLocaleString() || 'N/A'}</Table.Td>
                        <Table.Td ta="center">
                          {peerMetrics ? 
                            `${providerMetrics.total_disputes > peerMetrics.total_disputes ? '+' : ''}${(providerMetrics.total_disputes - peerMetrics.total_disputes).toLocaleString()}` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                      
                      <Table.Tr>
                        <Table.Td fw={500}>Provider Win Rate</Table.Td>
                        <Table.Td ta="center">{providerMetrics.provider_win_rate.toFixed(1)}%</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.provider_win_rate.toFixed(1) || 'N/A'}%</Table.Td>
                        <Table.Td ta="center" c={peerMetrics && (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate) > 0 ? 'green' : 'red'}>
                          {peerMetrics ? 
                            `${(providerMetrics.provider_win_rate - peerMetrics.provider_win_rate) > 0 ? '+' : ''}${(providerMetrics.provider_win_rate - peerMetrics.provider_win_rate).toFixed(1)}pp` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                      
                      <Table.Tr>
                        <Table.Td fw={500}>Average Offer (% QPA)</Table.Td>
                        <Table.Td ta="center">{providerMetrics.avg_provider_offer_pct?.toFixed(0) || 'N/A'}%</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.avg_provider_offer_pct?.toFixed(0) || 'N/A'}%</Table.Td>
                        <Table.Td ta="center">
                          {peerMetrics && providerMetrics.avg_provider_offer_pct && peerMetrics.avg_provider_offer_pct ? 
                            `${(providerMetrics.avg_provider_offer_pct - peerMetrics.avg_provider_offer_pct) > 0 ? '+' : ''}${(providerMetrics.avg_provider_offer_pct - peerMetrics.avg_provider_offer_pct).toFixed(0)}pp` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                      
                      <Table.Tr>
                        <Table.Td fw={500}>Average Winning Offer (% QPA)</Table.Td>
                        <Table.Td ta="center">{providerMetrics.avg_winning_offer_pct?.toFixed(0) || 'N/A'}%</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.avg_winning_offer_pct?.toFixed(0) || 'N/A'}%</Table.Td>
                        <Table.Td ta="center">
                          {peerMetrics && providerMetrics.avg_winning_offer_pct && peerMetrics.avg_winning_offer_pct ? 
                            `${(providerMetrics.avg_winning_offer_pct - peerMetrics.avg_winning_offer_pct) > 0 ? '+' : ''}${(providerMetrics.avg_winning_offer_pct - peerMetrics.avg_winning_offer_pct).toFixed(0)}pp` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                      
                      <Table.Tr>
                        <Table.Td fw={500}>Median Resolution Days</Table.Td>
                        <Table.Td ta="center">{providerMetrics.median_resolution_days?.toFixed(0) || 'N/A'}</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.median_resolution_days?.toFixed(0) || 'N/A'}</Table.Td>
                        <Table.Td ta="center" c={peerMetrics && providerMetrics.median_resolution_days && peerMetrics.median_resolution_days && (providerMetrics.median_resolution_days - peerMetrics.median_resolution_days) < 0 ? 'green' : 'red'}>
                          {peerMetrics && providerMetrics.median_resolution_days && peerMetrics.median_resolution_days ? 
                            `${(providerMetrics.median_resolution_days - peerMetrics.median_resolution_days) > 0 ? '+' : ''}${(providerMetrics.median_resolution_days - peerMetrics.median_resolution_days).toFixed(0)} days` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                      
                      <Table.Tr>
                        <Table.Td fw={500}>Average IDRE Compensation</Table.Td>
                        <Table.Td ta="center">{providerMetrics.avg_idre_compensation ? `$${providerMetrics.avg_idre_compensation.toFixed(0)}` : 'N/A'}</Table.Td>
                        <Table.Td ta="center">{peerMetrics?.avg_idre_compensation ? `$${peerMetrics.avg_idre_compensation.toFixed(0)}` : 'N/A'}</Table.Td>
                        <Table.Td ta="center">
                          {peerMetrics && providerMetrics.avg_idre_compensation && peerMetrics.avg_idre_compensation ? 
                            `${(providerMetrics.avg_idre_compensation - peerMetrics.avg_idre_compensation) > 0 ? '+' : ''}$${(providerMetrics.avg_idre_compensation - peerMetrics.avg_idre_compensation).toFixed(0)}` 
                            : 'N/A'
                          }
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>
      
      {/* Footer - Sticks to bottom */}
      <Paper shadow="sm" py="md" style={{ marginTop: 'auto' }}>
        <Container size="xl">
          <Group justify="center" align="center" gap="xs">
            <Image 
              src="/logo.svg" 
              alt="Clearest Health" 
              width={20} 
              height={14}
            />
            <Text size="sm" c="gray.6">
              Powered by{' '}
              <Text 
                component="a" 
                href="https://www.clearesthealth.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                c="green.6"
                td="none"
                style={{ fontWeight: 500 }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Clearest Health
              </Text>
            </Text>
          </Group>
        </Container>
      </Paper>
    </Box>
  )
}
