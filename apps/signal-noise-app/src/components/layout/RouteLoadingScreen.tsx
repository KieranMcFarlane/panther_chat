import { Loader2 } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

interface RouteLoadingScreenProps {
  eyebrow?: string
  title: string
  description: string
}

export default function RouteLoadingScreen({
  eyebrow = 'Loading',
  title,
  description,
}: RouteLoadingScreenProps) {
  return (
    <main className="min-h-screen bg-custom-bg px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-custom-border bg-custom-box/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
              <h1 className="text-3xl font-semibold text-white">{title}</h1>
              <p className="max-w-2xl text-sm text-slate-300">{description}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-custom-border bg-custom-box/60 p-5">
              <Skeleton className="h-4 w-24 bg-slate-700" />
              <Skeleton className="mt-4 h-8 w-16 bg-slate-700" />
              <Skeleton className="mt-3 h-3 w-32 bg-slate-700" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-custom-border bg-custom-box/60 p-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48 bg-slate-700" />
            <Skeleton className="h-4 w-full bg-slate-700" />
            <Skeleton className="h-4 w-11/12 bg-slate-700" />
            <Skeleton className="h-4 w-10/12 bg-slate-700" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-custom-border bg-custom-bg/70 p-4">
                <Skeleton className="h-4 w-36 bg-slate-700" />
                <Skeleton className="mt-4 h-24 w-full bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
