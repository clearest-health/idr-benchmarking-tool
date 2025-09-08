'use client'

import { useState, useEffect } from 'react'
import { BenchmarkingService } from '@/lib/benchmarking'
import { BenchmarkMetrics, BenchmarkFilters } from '@/lib/supabase'
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
    using_sample_data?: boolean
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
  const [practiceName, setPracticeName] = useState('')
  const [practiceNameSuggestions, setPracticeNameSuggestions] = useState<string[]>([])
  const [practiceNameLoading, setPracticeNameLoading] = useState(false)
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
  const [serviceCodeSearch, setServiceCodeSearch] = useState('')
  const [showAllServiceCodes, setShowAllServiceCodes] = useState(false)

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
    if (practiceData.length > 0 && practiceName && !selectedPractice) {
      const exactMatch = practiceData.find(p => p.name.toLowerCase() === practiceName.toLowerCase())
      if (exactMatch) {
        handlePracticeSelection(exactMatch.name)
      }
    }
  }, [practiceData, practiceName, selectedPractice])

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

      // Auto-populate the form fields
      setFilters(prev => ({
        ...prev,
        specialty: practice.specialty || prev.specialty,
        state: practice.location || prev.state,
        practice_size: practice.size || prev.practice_size
      }))
    }
  }

  const runBenchmarkAnalysis = async () => {
    if (!filters.specialty) {
      alert('Please select a specialty to run the analysis')
      return
    }

    setLoading(true)
    try {
      // Include practice name in filters for provider-specific analysis
      const providerFilters = {
        ...filters,
        practice_name: practiceName.trim() || undefined
      }

      const [providerData, peerData] = await Promise.all([
        BenchmarkingService.getProviderBenchmark(providerFilters),
        BenchmarkingService.getPeerBenchmark(filters) // Keep peer comparison broad (no practice name filter)
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

  const COLORS = ['#2E8B57', '#4682B4']

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
                  🎯 Define Your Practice Profile
                </Title>
              
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
              
              {/* Practice Name */}
              <Autocomplete
                label="Practice Name (Optional)"
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

              {/* Specialty */}
              <Select
                label="Practice Specialty *"
                value={filters.specialty || null}
                onChange={(value) => setFilters({...filters, specialty: value || undefined})}
                disabled={filtersLoading}
                placeholder={filtersLoading ? 'Loading specialties...' : 'Select Specialty'}
                data={filterOptions.specialties.slice(0, 50).map(specialty => ({
                  value: specialty,
                  label: specialty.length > 40 ? `${specialty.substring(0, 40)}...` : specialty
                }))}
                searchable
                clearable
                mb="md"
                description={filterOptions.metadata?.total_specialties ? 
                  `${filterOptions.metadata.total_specialties} specialties available${
                    filterOptions.metadata?.using_sample_data ? ' (sample data - database empty)' : ''
                  }` : undefined
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

              {/* Service Codes */}
              <Stack gap="xs" mb="xl">
                <Text size="sm" fw={500} c="gray.7">
                  Focus Procedures
                  {filters.specialty && (
                    <Text span size="xs" c="green.6" ml="xs">
                      (filtered by {filters.specialty.substring(0, 20)}...)
                    </Text>
                  )}
                </Text>
                
                <MultiSelect
                  placeholder="Search and select procedures..."
                  value={filters.service_codes || []}
                  onChange={(value) => setFilters({...filters, service_codes: value})}
                  disabled={filtersLoading}
                  data={filterOptions.top_service_codes
                    .slice(0, showAllServiceCodes ? 100 : 30)
                    .map(code => ({
                      value: code.service_code,
                      label: `${code.service_code} - ${code.description?.substring(0, 30)}... (Win: ${code.provider_win_rate?.toFixed(0)}%, Cases: ${code.dispute_count})`
                    }))
                  }
                  searchable
                  clearable
                  hidePickedOptions
                  maxDropdownHeight={200}
                />
                
                {filterOptions.metadata?.total_service_codes && (
                  <Group justify="space-between">
                    <Text size="xs" c="gray.5">
                      Showing {Math.min(showAllServiceCodes ? 100 : 30, filterOptions.metadata.total_service_codes)} of {filterOptions.metadata.total_service_codes} procedures
                    </Text>
                    {filterOptions.metadata.total_service_codes > 30 && (
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        onClick={() => setShowAllServiceCodes(!showAllServiceCodes)}
                        color="green"
                      >
                        {showAllServiceCodes ? 'Show Less' : 'Show More'}
                      </Button>
                    )}
                  </Group>
                )}
              </Stack>

              {/* Run Analysis Button */}
              <Button
                onClick={runBenchmarkAnalysis}
                disabled={loading || !filters.specialty}
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
                    📊 Performance Summary: {practiceName.trim() || 'Your Practice'}
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
                            <Text size="sm" fw={500} c="orange.9">Disputes</Text>
                            <Text size="xl" fw={700} c="orange.6">
                              {providerMetrics.total_disputes.toLocaleString()}
                            </Text>
                            <Text size="xs" c="orange.7">analyzed</Text>
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
                        <Box h={200}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={winRateData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={12} />
                              <YAxis domain={[0, 100]} />
                              <Tooltip formatter={(value) => [`${value}%`, 'Win Rate']} />
                              <Bar dataKey="value" fill="#2E8B57" />
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
                        <Box h={200}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={offerData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={12} />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value}%`, 'Offer % QPA']} />
                              <Bar dataKey="value" fill="#4682B4" />
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
                        <Box h={200}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={resolutionData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={12} />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value}`, 'Days']} />
                              <Bar dataKey="value" fill="#9333ea" />
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
                        <Title order={4} size="md" c="gray.9" mb="xs">Your Practice Profile:</Title>
                        <Text size="sm" c="gray.6" component="ul" style={{ listStyleType: 'none', padding: 0 }}>
                          <li>• Specialty: {filters.specialty}</li>
                          <li>• Location: {filters.state || 'All States (not specified)'}</li>
                          <li>• Size: {filters.practice_size || 'All Sizes (not specified)'}</li>
                          {practiceName.trim() && (
                            <li>• Practice Name: "{practiceName.trim()}"</li>
                          )}
                          {filters.service_codes && filters.service_codes.length > 0 && (
                            <li>• Service Codes: {filters.service_codes.slice(0, 3).join(', ')}{filters.service_codes.length > 3 ? '...' : ''}</li>
                          )}
                        </Text>
                      </Box>
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Box>
                        <Title order={4} size="md" c="gray.9" mb="xs">Peer Comparison Group:</Title>
                        <Text size="sm" c="gray.6" component="ul" style={{ listStyleType: 'none', padding: 0 }}>
                          <li>• Same specialty: {filters.specialty}</li>
                          <li>• All locations (broader scope)</li>
                          <li>• All practice sizes</li>
                          <li>• Total peer disputes: {peerMetrics?.total_disputes.toLocaleString() || '0'}</li>
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
