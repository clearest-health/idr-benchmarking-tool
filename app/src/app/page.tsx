import BenchmarkingDashboard from '@/components/BenchmarkingDashboard'
import { PostHogPageView } from '@/lib/posthog'

export default function Home() {
  return (
    <>
      <PostHogPageView />
      <BenchmarkingDashboard />
    </>
  )
}