'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Command, CommandInput } from '@/components/ui/command';
import { FacetFilterBar, type FacetFilterField } from '@/components/filters/FacetFilterBar';
import { EntityBadge } from '@/components/badge/EntityBadge';
import { useEntity, useEntityTaxonomy, useEntitiesBrowserData } from '@/lib/swr-config';
import { getCanonicalEntityKey } from '@/lib/entity-canonicalization';
import { getEntityBrowserDossierHref } from '@/lib/entity-routing';
import { formatValue } from '@/lib/formatValue';
import type { EntityBrowserFilters } from '@/lib/entity-browser-data';
import type { EntitiesTaxonomyResponse } from '@/lib/entities-taxonomy';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface LeagueNavSimpleProps {
  currentEntity?: any | null;
}

type BrowserEntity = {
  id: string
  uuid?: string
  neo4j_id?: string | number
  labels?: string[]
  properties: Record<string, any>
}

function toBrowserEntity(entity: any): BrowserEntity {
  return {
    id: String(entity?.id || entity?.uuid || entity?.neo4j_id || ''),
    uuid: entity?.uuid || entity?.properties?.uuid || undefined,
    neo4j_id: entity?.neo4j_id,
    labels: Array.isArray(entity?.labels) ? entity.labels : [],
    properties: { ...(entity?.properties || {}) },
  }
}

function getEntityContext(entity: BrowserEntity | null | undefined) {
  if (!entity) return ''
  const parts = [
    formatValue(entity.properties?.entity_role || entity.properties?.type),
    formatValue(entity.properties?.sport),
    formatValue(entity.properties?.league || entity.properties?.level),
    formatValue(entity.properties?.country),
  ].filter(Boolean)
  return parts.join(' • ')
}

function buildFilterFields(
  filters: EntityBrowserFilters,
  taxonomy: EntitiesTaxonomyResponse | null,
  updateFilters: (updater: (prev: EntityBrowserFilters) => EntityBrowserFilters) => void,
): FacetFilterField[] {
  const availableSports = taxonomy?.sports ?? []
  const availableLeagues = taxonomy?.leagues ?? []
  const availableCountries = taxonomy?.countries ?? []
  const availableEntityRoles = taxonomy?.entityRoles ?? taxonomy?.entityClasses ?? []

  return [
    {
      key: 'entityType',
      label: 'Entity Type',
      value: filters.entityType,
      placeholder: 'Entity Type',
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'Entity', label: 'Entity' },
        { value: 'Club', label: 'Club' },
        { value: 'League', label: 'League' },
        { value: 'Federation', label: 'Federation' },
        { value: 'Competition', label: 'Competition' },
        { value: 'Person', label: 'Person' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, entityType: value })),
    },
    {
      key: 'sport',
      label: 'Sport',
      value: filters.sport,
      placeholder: 'Sport',
      options: [
        { value: 'all', label: 'All Sports' },
        ...availableSports.map((sport) => ({ value: sport, label: sport, count: taxonomy?.counts?.sports?.[sport] ?? 0 })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sport: value })),
    },
    {
      key: 'league',
      label: 'League',
      value: filters.league,
      placeholder: 'League',
      options: [
        { value: 'all', label: 'All Leagues' },
        ...availableLeagues.map((league) => ({ value: league, label: league, count: taxonomy?.counts?.leagues?.[league] ?? 0 })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, league: value })),
    },
    {
      key: 'country',
      label: 'Country',
      value: filters.country,
      placeholder: 'Country',
      options: [
        { value: 'all', label: 'All Countries' },
        ...availableCountries.map((country) => ({ value: country, label: country, count: taxonomy?.counts?.countries?.[country] ?? 0 })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, country: value })),
    },
    {
      key: 'entityClass',
      label: 'Entity Role',
      value: filters.entityClass,
      placeholder: 'Entity Role',
      options: [
        { value: 'all', label: 'All Roles' },
        ...availableEntityRoles.map((entityRole) => ({
          value: entityRole,
          label: entityRole,
          count: taxonomy?.counts?.entityRoles?.[entityRole] ?? taxonomy?.counts?.entityClasses?.[entityRole] ?? 0,
        })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, entityClass: value })),
    },
    {
      key: 'sortBy',
      label: 'Sort By',
      value: filters.sortBy,
      placeholder: 'Sort By',
      options: [
        { value: 'popular', label: 'Popular' },
        { value: 'name', label: 'Name' },
        { value: 'type', label: 'Type' },
        { value: 'sport', label: 'Sport' },
        { value: 'country', label: 'Country' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sortBy: value })),
    },
    {
      key: 'sortOrder',
      label: 'Sort Order',
      value: filters.sortOrder,
      placeholder: 'Sort Order',
      options: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sortOrder: value as 'asc' | 'desc' })),
    },
  ]
}

export default function LeagueNavSimple({ currentEntity = null }: LeagueNavSimpleProps) {
  const router = useRouter()
  const params = useParams()
  const entityId = String(params.entityId || currentEntity?.id || '')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [gridWidth, setGridWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [filters, setFilters] = useState<EntityBrowserFilters>({
    entityType: 'all',
    sport: 'all',
    league: 'all',
    country: 'all',
    entityClass: 'all',
    sortBy: 'popular',
    sortOrder: 'desc',
    limit: '50',
  })

  const { entity: fetchedCurrentEntity } = useEntity(currentEntity ? null : entityId)
  const currentEntityData = currentEntity ?? fetchedCurrentEntity
  const { taxonomy } = useEntityTaxonomy(null)
  const { entitiesData, entitiesError, entitiesLoading, entitiesValidating, reloadEntities } = useEntitiesBrowserData(
    currentPage,
    searchTerm,
    filters,
    null,
  )

  const updateFilters = useCallback((updater: (prev: EntityBrowserFilters) => EntityBrowserFilters) => {
    setCurrentPage(1)
    setFilters(updater)
  }, [])

  useEffect(() => {
    const element = gridContainerRef.current
    if (!element) return

    const updateWidth = () => setGridWidth(element.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(element)
    return () => observer.disconnect()
  }, [entitiesLoading, entitiesData?.entities?.length])

  const activeFilterChips = [
    filters.sport !== 'all' ? { key: 'sport', label: `Sport: ${filters.sport}` } : null,
    filters.league !== 'all' ? { key: 'league', label: `League: ${filters.league}` } : null,
    filters.country !== 'all' ? { key: 'country', label: `Country: ${filters.country}` } : null,
    filters.entityClass !== 'all' ? { key: 'entityClass', label: `Role: ${filters.entityClass}` } : null,
    filters.entityType !== 'all' ? { key: 'entityType', label: `Type: ${filters.entityType}` } : null,
  ].filter(Boolean) as Array<{ key: 'sport' | 'league' | 'country' | 'entityClass' | 'entityType', label: string }>

  const filterFields = useMemo(() => buildFilterFields(filters, taxonomy, updateFilters), [filters, taxonomy, updateFilters])
  const filterChips = activeFilterChips.map((chip) => ({
    key: chip.key,
    label: chip.label,
    onRemove: () => updateFilters((prev) => ({ ...prev, [chip.key]: 'all' })),
  }))

  const visibleEntities: BrowserEntity[] = (entitiesData?.entities || []).map(toBrowserEntity)
  const currentEntityRecord = useMemo(() => {
    const currentKey = getCanonicalEntityKey(currentEntityData)
    return (
      visibleEntities.find((entity) => entity.id === entityId || getCanonicalEntityKey(entity) === currentKey) ||
      toBrowserEntity(currentEntityData)
    )
  }, [currentEntityData, entityId, visibleEntities])

  const currentIndex = useMemo(() => {
    const currentKey = getCanonicalEntityKey(currentEntityRecord)
    return visibleEntities.findIndex((entity) => entity.id === currentEntityRecord?.id || getCanonicalEntityKey(entity) === currentKey)
  }, [currentEntityRecord, visibleEntities])

  const navigateToEntity = useCallback((entity: BrowserEntity | undefined) => {
    if (!entity) return
    const href = getEntityBrowserDossierHref(entity, '1')
    if (!href) return
    setIsModalOpen(false)
    setSearchTerm('')
    router.push(href)
  }, [router])

  const handleUp = useCallback(() => {
    if (!visibleEntities.length || currentIndex < 0) return
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : visibleEntities.length - 1
    navigateToEntity(visibleEntities[nextIndex])
  }, [currentIndex, navigateToEntity, visibleEntities])

  const handleDown = useCallback(() => {
    if (!visibleEntities.length || currentIndex < 0) return
    const nextIndex = currentIndex < visibleEntities.length - 1 ? currentIndex + 1 : 0
    navigateToEntity(visibleEntities[nextIndex])
  }, [currentIndex, navigateToEntity, visibleEntities])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isModalOpen) return
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        handleUp()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        handleDown()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleDown, handleUp, isModalOpen])

  const currentContext = getEntityContext(currentEntityRecord)
  const title = currentEntityRecord?.properties?.name || 'Browse Entities'
  const description = 'Search by club, sport, country, league, federation, or competition using the canonical entity browser taxonomy.'

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[960px] overflow-hidden rounded-2xl border-0 bg-header-bg p-0 shadow-2xl">
          <div className="flex h-full w-full flex-col">
            <DialogHeader className="border-b border-white/10 px-6 py-5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-hidden p-6">
              <FacetFilterBar
                searchSlot={
                  <div className="relative">
                    <Command className="overflow-visible rounded-md border border-input bg-background shadow-sm">
                      <CommandInput
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                        placeholder="Search club, sport, country, league..."
                        className="h-11 border-0 pl-2"
                      />
                    </Command>
                  </div>
                }
                fields={filterFields}
                chips={filterChips}
                actions={[
                  {
                    key: 'reset',
                    label: 'Reset',
                    onClick: () => {
                      setSearchTerm('')
                      setCurrentPage(1)
                      setFilters({
                        entityType: 'all',
                        sport: 'all',
                        league: 'all',
                        country: 'all',
                        entityClass: 'all',
                        sortBy: 'popular',
                        sortOrder: 'desc',
                        limit: '50',
                      })
                    },
                  },
                ]}
                status={
                  <Badge variant="outline">
                    Showing {visibleEntities.length} of {(entitiesData?.pagination?.total || visibleEntities.length).toLocaleString()} entities
                  </Badge>
                }
                className="bg-header-bg"
              />

              <div ref={gridContainerRef} className="max-h-[420px] overflow-y-auto rounded-xl border border-white/10 bg-black/10 p-3">
                {entitiesValidating || entitiesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-white/60">
                        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
                        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                ) : entitiesError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                    {entitiesError.message}
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={() => reloadEntities()}>
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : visibleEntities.length === 0 ? (
                  <div className="rounded-lg border border-white/10 p-6 text-center text-white/70">
                    <Search className="mx-auto mb-3 h-8 w-8 opacity-60" />
                    <div className="text-base font-medium">No entities found</div>
                    <div className="mt-1 text-sm">Try a different sport, country, or league filter.</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleEntities.map((entity) => {
                      const isCurrent = entity.id === currentEntityRecord?.id || getCanonicalEntityKey(entity) === getCanonicalEntityKey(currentEntityRecord)
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                            isCurrent ? 'border-blue-400 bg-blue-600/20 text-white' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          }`}
                          onClick={() => navigateToEntity(entity)}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{formatValue(entity.properties?.name || entity.id)}</div>
                            <div className="truncate text-sm text-white/60">
                              {getEntityContext(entity)}
                            </div>
                          </div>
                          <div className="ml-4 shrink-0 text-sm text-white/60">
                            →
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <div className="text-sm text-white/60">
                  {currentEntityRecord
                    ? `Browsing: ${getEntityContext(currentEntityRecord) || 'Canonical entity'}`
                    : 'Browsing canonical entity data'}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EntityBadge
        entity={currentEntityRecord}
        size="xl"
        onClick={() => setIsModalOpen(true)}
      />

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUp}
          disabled={currentIndex < 0 || visibleEntities.length === 0}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDown}
          disabled={currentIndex < 0 || visibleEntities.length === 0}
          className="text-white hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-w-[120px]">
        <div className="text-white text-3xl font-extrabold mb-1">
          {formatValue(currentEntityRecord?.properties?.name) || 'Loading...'}
        </div>
        <div className="text-white/60 text-xl">
          {currentContext || 'Canonical entity'}
        </div>
      </div>
    </div>
  )
}
