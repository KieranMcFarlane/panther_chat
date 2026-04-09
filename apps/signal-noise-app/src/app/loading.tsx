import RouteLoadingScreen from '@/components/layout/RouteLoadingScreen'

export default function Loading() {
  return (
    <RouteLoadingScreen
      eyebrow="Signal Noise"
      title="Loading workspace"
      description="Fetching the next route and preparing the latest operational state."
    />
  )
}
