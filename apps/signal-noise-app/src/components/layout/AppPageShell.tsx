import * as React from 'react'

import { cn } from '@/lib/utils'

export function AppPageShell({
  children,
  className,
  size = 'default',
}: {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'wide' | 'narrow'
}) {
  const widthClass =
    size === 'wide' ? 'max-w-[96rem]' : size === 'narrow' ? 'max-w-4xl' : 'max-w-7xl'

  return (
    <main className={cn('min-h-screen bg-background text-foreground', className)}>
      <div className={cn('mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8', widthClass)}>
        {children}
      </div>
    </main>
  )
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {description ? <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export function AppPageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>
}
