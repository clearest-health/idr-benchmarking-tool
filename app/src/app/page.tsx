import { Suspense } from 'react'
import { Box, Loader, Stack, Text } from '@mantine/core'
import BenchmarkingDashboard from '@/components/BenchmarkingDashboard'
import { PostHogPageView } from '@/lib/posthog'

function LoadingFallback() {
  return (
    <Box bg="gray.0" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" color="green" />
        <Text size="lg" c="gray.7">Loading IDR Benchmarking Tool...</Text>
      </Stack>
    </Box>
  )
}

export default function Home() {
  return (
    <>
      <PostHogPageView />
      <Suspense fallback={<LoadingFallback />}>
        <BenchmarkingDashboard />
      </Suspense>
    </>
  )
}