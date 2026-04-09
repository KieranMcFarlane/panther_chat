import RouteLoadingScreen from '@/components/layout/RouteLoadingScreen'

export default function Loading() {
  return (
    <RouteLoadingScreen
      eyebrow="Tenders"
      title="Loading tenders"
      description="Fetching procurement opportunities and their latest verification state."
    />
  )
}
