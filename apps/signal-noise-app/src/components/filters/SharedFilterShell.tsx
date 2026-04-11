"use client"

import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type FacetFilterOption = {
  value: string
  label: string
  count?: number
}

export type FacetFilterField = {
  key: string
  label: string
  value: string
  placeholder: string
  options: FacetFilterOption[]
  onValueChange: (value: string) => void
}

export type FacetFilterChip = {
  key: string
  label: string
  onRemove: () => void
}

export type FacetFilterAction = {
  key: string
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  disabled?: boolean
}

export interface SharedFilterShellProps {
  searchSlot?: ReactNode
  fields: FacetFilterField[]
  actions?: FacetFilterAction[]
  chips?: FacetFilterChip[]
  status?: ReactNode
  className?: string
  gridClassName?: string
}

export function SharedFilterShell({
  searchSlot,
  fields,
  actions = [],
  chips = [],
  status,
  className,
  gridClassName = 'grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
}: SharedFilterShellProps) {
  return (
    <Card className={cn('border-border/70 shadow-sm', className)}>
      <CardContent className="p-3.5 md:p-4">
        {searchSlot ? <div className="mb-3">{searchSlot}</div> : null}

        {fields.length > 0 ? (
          <div className={cn('grid', gridClassName)}>
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
                <Select value={field.value} onValueChange={field.onValueChange}>
                  <SelectTrigger aria-label={field.label}>
                    <SelectValue placeholder={field.placeholder || field.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        {typeof option.count === 'number' ? ` (${option.count})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}

        {(actions.length > 0 || status) ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                onClick={action.onClick}
                variant={action.variant || 'outline'}
                size={action.size || 'sm'}
                disabled={action.disabled}
              >
                {action.icon ? <span className="mr-2">{action.icon}</span> : null}
                {action.label}
              </Button>
            ))}

            {status ? <div className="ml-auto">{status}</div> : null}
          </div>
        ) : null}

        {chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Button key={chip.key} variant="secondary" size="sm" onClick={chip.onRemove}>
                {chip.label} ×
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
