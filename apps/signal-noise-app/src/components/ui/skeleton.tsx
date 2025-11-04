import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export function EntityProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-24" />
              <div className="w-20 h-20 rounded-lg" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Entity Header Card */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-16 h-16 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-10 w-20" />
              </div>
            </div>

            {/* Key Information Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* About Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-24 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>

            {/* Connections Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded" />
                      <div>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-24 mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="h-8 w-16 mx-auto mb-1" />
                    <Skeleton className="h-3 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-28 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Card */}
            <div className="rounded-lg border bg-card p-6">
              <Skeleton className="h-6 w-20 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BadgeSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16",
    xl: "w-20 h-20"
  }

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-muted animate-pulse`} />
  )
}

export function DataFieldSkeleton({ showLabel = true }: { showLabel?: boolean }) {
  return (
    <div className="space-y-2">
      {showLabel && <Skeleton className="h-3 w-20" />}
      <Skeleton className="h-4 w-32" />
    </div>
  )
}