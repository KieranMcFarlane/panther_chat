import RouteLoadingScreen from '@/components/layout/RouteLoadingScreen'

export default function Loading() {
  return (
    <RouteLoadingScreen
      eyebrow="CSV Import"
      title="Loading import pipeline"
      description="Preparing the entity intake flow and current batch state."
    />
  )
}
