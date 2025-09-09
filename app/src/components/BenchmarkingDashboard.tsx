'use client'

import { useState, useEffect } from 'react'
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
  TextInput,
  Button,
  Card,
  Group,
  Stack,
  Badge,
  Loader,
  Alert,
  MultiSelect,
  Divider,
  ActionIcon,
  Tooltip as MantineTooltip,
  Box,
  Flex,
  Autocomplete,
  Table
} from '@mantine/core'
import { 
  IconChartBar, 
  IconMapPin, 
  IconBuilding,
  IconClock,
  IconCurrencyDollar,
  IconTrophy,
  IconSearch,
  IconX,
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
  metadata?: {
    quarter?: string
    specialty_filter?: string
    state_filter?: string
    total_specialties?: number
    using_sample_data?: boolean
  }
}

interface Insight {
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
}

export default function BenchmarkingDashboard() {
  const posthog = usePostHog()
  
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
      const urlPracticeName = urlParams.get('practice_name')
      const urlSpecialty = urlParams.get('specialty')
      const urlState = urlParams.get('state')
      const urlPracticeSize = urlParams.get('practice_size')
      const urlQuarter = urlParams.get('quarter')

      if (urlPracticeName) {
        setPracticeName(urlPracticeName)
        // Trigger search to get practice data and auto-populate fields
        setTimeout(() => searchPracticeNames(urlPracticeName), 100)
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

  // Auto-select practice when search results come back (for URL parameters)
  useEffect(() => {
    if (practiceData.length > 0 && practiceName && !selectedPractice && filterOptions.specialties.length > 0) {
      const exactMatch = practiceData.find(p => p.name.toLowerCase() === practiceName.toLowerCase())
      if (exactMatch) {
        handlePracticeSelection(exactMatch.name)
      }
    }
  }, [practiceData, practiceName, selectedPractice, filterOptions.specialties])

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
  const searchPracticeNames = async (query: string) => {
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
        setPracticeNameSuggestions(data.practices.map((p: any) => p.name))
      }
    } catch (error) {
      console.error('Error searching practice names:', error)
    } finally {
      setPracticeNameLoading(false)
    }
  }

  // Handle practice selection and auto-populate fields
  const handlePracticeSelection = (selectedPracticeName: string) => {
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
  }

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
        setEmailDomainSuggestions(data.domains.map((d: any) => d.domain))
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
        setFacilityGroupSuggestions(data.groups.map((g: any) => g.name))
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
                Free IDR Benchmarking Tool
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
          <Grid>
          {/* Sidebar - Filters */}
            <Grid.Col span={{ base: 12, lg: 3 }}>
            <Paper shadow="sm" p="lg">
              <Title order={2} size="lg" c="gray.9" mb="md">
                🎯 Define Your Profile
              </Title>

              {/* User Type Selection */}
              <Select
                label="I am a:"
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
                }}
                data={[
                  { value: 'individual_provider', label: '🏥 Individual Provider or Practice' },
                  { value: 'provider_group', label: '🏢 Provider Group or Health System' },
                  { value: 'law_firm', label: '⚖️ Law Firm' }
                ]}
                mb="lg"
                description="Select your role to customize the analysis and insights"
              />
              
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
              
              {/* Dynamic Input Fields Based on User Type */}
              {filters.user_type === 'individual_provider' && (
                <Autocomplete
                label="Practice or Facility Name"
                  value={practiceName}
                onChange={(value) => {
                  setPracticeName(value)
                  // Handle selection from dropdown
                  if (practiceNameSuggestions.includes(value)) {
                    handlePracticeSelection(value)
                  }
                  // Debounce the search
                  if (value && value.length >= 2) {
                    setTimeout(() => searchPracticeNames(value), 300)
                  } else {
                    setPracticeNameSuggestions([])
                    setPracticeData([])
                    setSelectedPractice(null)
                  }
                }}
                onFocus={() => {
                  if (practiceName && practiceName.length >= 2) {
                    searchPracticeNames(practiceName)
                  }
                }}
                data={practiceNameSuggestions}
                placeholder="Enter practice or facility name..."
                mb="md"
                description={selectedPractice 
                  ? `Selected: ${selectedPractice.name} - Fields auto-populated below`
                  : "Search for a specific practice/facility name to auto-populate other fields. Leave blank for broader analysis."
                }
                rightSection={practiceNameLoading ? <Loader size="xs" /> : undefined}
                limit={10}
                maxDropdownHeight={200}
              />
              )}

              {filters.user_type === 'law_firm' && (
                <Autocomplete
                  label="Your Law Firm Email Domain"
                  value={emailDomain}
                  onChange={(value) => {
                    setEmailDomain(value)
                    // Debounce the search
                    if (value && value.length >= 2) {
                      setTimeout(() => searchEmailDomains(value), 300)
                    } else {
                      setEmailDomainSuggestions([])
                    }
                  }}
                  onFocus={() => {
                    if (emailDomain && emailDomain.length >= 2) {
                      searchEmailDomains(emailDomain)
                    }
                  }}
                  data={emailDomainSuggestions}
                  placeholder="e.g., gottliebandgreenspan.com"
                  mb="md"
                  description="Enter your law firm's email domain to analyze all represented practices"
                  rightSection={emailDomainLoading ? <Loader size="xs" /> : undefined}
                  limit={10}
                  maxDropdownHeight={200}
                />
              )}

              {filters.user_type === 'provider_group' && (
                <Autocomplete
                  label="Your Provider Group Name"
                  value={facilityGroup}
                  onChange={(value) => {
                    setFacilityGroup(value)
                    // Debounce the search
                    if (value && value.length >= 2) {
                      setTimeout(() => searchFacilityGroups(value), 300)
                    } else {
                      setFacilityGroupSuggestions([])
                    }
                  }}
                  onFocus={() => {
                    if (facilityGroup && facilityGroup.length >= 2) {
                      searchFacilityGroups(facilityGroup)
                    }
                  }}
                  data={facilityGroupSuggestions}
                  placeholder="e.g., Empire Health System, Mayo Clinic, Kaiser"
                  mb="md"
                  description="Enter your provider group or health system name"
                  rightSection={facilityGroupLoading ? <Loader size="xs" /> : undefined}
                  limit={10}
                  maxDropdownHeight={200}
                />
              )}

              {/* Specialty */}
              <Select
                label={filters.user_type === 'individual_provider' ? 'Practice Specialty *' : 'Focus Specialty (Optional)'}
                value={filters.specialty || null}
                onChange={(value) => setFilters({...filters, specialty: value || undefined})}
                  disabled={filtersLoading}
                placeholder={filtersLoading ? 'Loading specialties...' : 
                  filters.user_type === 'individual_provider' ? 'Select Specialty' : 'All Specialties (Optional)'
                }
                data={filterOptions.specialties.map(specialty => ({
                  value: specialty,
                  label: specialty.length > 40 ? `${specialty.substring(0, 40)}...` : specialty
                }))}
                searchable
                clearable
                mb="md"
                description={
                  filters.user_type === 'individual_provider' 
                    ? `${filterOptions.metadata?.total_specialties || 0} specialties available`
                    : 'Optional: Filter analysis to a specific specialty, or leave blank for all specialties'
                }
              />

              {/* State */}
              <Select
                label={
                  <Group gap="xs">
                    <IconMapPin size={16} />
                    <Text>Geographic Location</Text>
                  </Group>
                }
                value={filters.state || null}
                onChange={(value) => setFilters({...filters, state: value || undefined})}
                  disabled={filtersLoading}
                placeholder={filtersLoading ? 'Loading states...' : 'All States (Optional)'}
                data={filterOptions.states.map(state => ({
                  value: state.code,
                  label: state.display
                }))}
                searchable
                clearable
                mb="md"
                description="Leave blank to compare against all geographic locations"
              />

              {/* Practice Size */}
              <Select
                label={
                  <Group gap="xs">
                    <IconBuilding size={16} />
                    <Text>Practice Size</Text>
                  </Group>
                }
                value={filters.practice_size || null}
                onChange={(value) => setFilters({...filters, practice_size: value || undefined})}
                  disabled={filtersLoading}
                placeholder={filtersLoading ? 'Loading sizes...' : 'All Sizes (Optional)'}
                data={filterOptions.practice_sizes.map(size => ({
                  value: size,
                  label: size
                }))}
                clearable
                mb="md"
                description="Leave blank to compare against all practice sizes"
              />

              {/* Run Analysis Button */}
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
                color="green"
                size="md"
                fullWidth
                leftSection={!loading ? '🚀' : undefined}
              >
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </Button>
            </Paper>
          </Grid.Col>

          {/* Main Content */}
          <Grid.Col span={{ base: 12, lg: 9 }}>
            {!providerMetrics ? (
              // Welcome State
              <Paper shadow="sm" p="xl" ta="center">
                <IconTrophy size={64} color="var(--mantine-color-green-6)" style={{ margin: '0 auto 1rem' }} />
                <Title order={2} size="h2" c="gray.9" mb="md">
                  Welcome to IDR Benchmarking
                </Title>
                <Box maw={800} mx="auto" c="gray.6">
                  <Text size="lg" mb="xl">
                    We've been studying IDR outcomes and have identified patterns in why some groups lose or waste money in arbitration.
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
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Card bg="green.0" p="md">
                        <Group align="center">
                          <IconTrophy size={32} color="var(--mantine-color-green-6)" />
                          <div>
                            <Text size="sm" fw={500} c="green.9">Win Rate</Text>
                            <Text size="xl" fw={700} c="green.6">
                            {providerMetrics.provider_win_rate.toFixed(1)}%
                            </Text>
                            <Text size="xs" c="green.7">
                            {peerMetrics && (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate) > 0 ? '+' : ''}
                            {peerMetrics ? (providerMetrics.provider_win_rate - peerMetrics.provider_win_rate).toFixed(1) : '0.0'}pp vs peers
                            </Text>
                        </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Card bg="blue.0" p="md">
                        <Group align="center">
                          <IconCurrencyDollar size={32} color="var(--mantine-color-blue-6)" />
                          <div>
                            <Text size="sm" fw={500} c="blue.9">Avg Offer</Text>
                            <Text size="xl" fw={700} c="blue.6">
                            {providerMetrics.avg_provider_offer_pct?.toFixed(0) || 'N/A'}%
                            </Text>
                            <Text size="xs" c="blue.7">QPA</Text>
                        </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Card bg="violet.0" p="md">
                        <Group align="center">
                          <IconClock size={32} color="var(--mantine-color-violet-6)" />
                          <div>
                            <Text size="sm" fw={500} c="violet.9">Resolution</Text>
                            <Text size="xl" fw={700} c="violet.6">
                            {providerMetrics.median_resolution_days?.toFixed(0) || 'N/A'}
                            </Text>
                            <Text size="xs" c="violet.7">days</Text>
                        </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Card bg="orange.0" p="md">
                        <Group align="center">
                          <IconChartBar size={32} color="var(--mantine-color-orange-6)" />
                          <div>
                            <Text size="sm" fw={500} c="orange.9">
                              {filters.user_type === 'law_firm' ? 'Total Disputes' : 
                               filters.user_type === 'provider_group' ? 'Total Disputes' : 'Disputes'}
                            </Text>
                            <Text size="xl" fw={700} c="orange.6">
                            {providerMetrics.total_disputes.toLocaleString()}
                            </Text>
                            <Text size="xs" c="orange.7">
                              {filters.user_type === 'law_firm' ? 'across all clients' :
                               filters.user_type === 'provider_group' ? 'across all facilities' : 'analyzed'}
                            </Text>
                        </div>
                        </Group>
                      </Card>
                    </Grid.Col>

                    {/* Additional Metrics for Law Firms and Provider Groups */}
                    {(filters.user_type === 'law_firm' || filters.user_type === 'provider_group') && (
                      <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                        <Card bg="teal.0" p="md">
                          <Group align="center">
                            <IconBuilding size={32} color="var(--mantine-color-teal-6)" />
                            <div>
                              <Text size="sm" fw={500} c="teal.9">
                                {filters.user_type === 'law_firm' ? 'Practices' : 'Facilities'}
                              </Text>
                              <Text size="xl" fw={700} c="teal.6">
                                {filters.user_type === 'law_firm' ? 
                                  (providerMetrics.total_practices?.toLocaleString() || '0') :
                                  (providerMetrics.total_facilities?.toLocaleString() || '0')
                                }
                              </Text>
                              <Text size="xs" c="teal.7">
                                {filters.user_type === 'law_firm' ? 'represented' : 'in network'}
                              </Text>
                      </div>
                          </Group>
                        </Card>
                      </Grid.Col>
                    )}
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
                            <li>• Email Domain: "{emailDomain.trim()}"</li>
                          )}
                          {filters.user_type === 'provider_group' && facilityGroup.trim() && (
                            <li>• Provider Group: "{facilityGroup.trim()}"</li>
                          )}
                          {filters.user_type === 'individual_provider' && practiceName.trim() && (
                            <li>• Practice Name: "{practiceName.trim()}"</li>
                          )}
                          <li>• Focus Specialty: {filters.specialty || 'All Specialties'}</li>
                          <li>• Location: {filters.state || 'All States (not specified)'}</li>
                          {filters.user_type === 'individual_provider' && (
                            <li>• Size: {filters.practice_size || 'All Sizes (not specified)'}</li>
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
          </Grid.Col>
        </Grid>
      </Container>
      </Box>
      
      {/* Footer - Sticks to bottom */}
      <Paper shadow="sm" py="md" style={{ marginTop: 'auto' }}>
        <Container size="xl">
          <Group justify="center" align="center" gap="xs">
            <img 
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
