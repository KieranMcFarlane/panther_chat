"use client"

import { SharedFilterShell, type SharedFilterShellProps } from './SharedFilterShell'

export type { FacetFilterAction, FacetFilterChip, FacetFilterField, FacetFilterOption } from './SharedFilterShell'

export function FacetFilterBar(props: SharedFilterShellProps) {
  return <SharedFilterShell {...props} />
}
