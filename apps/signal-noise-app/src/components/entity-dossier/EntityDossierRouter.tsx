"use client"

import { useState } from 'react'
import { Entity, EntityType, detectEntityType } from './types'
import { ClubDossier } from './ClubDossier'
import { PersonDossier } from './PersonDossier'
import { PartnerDossier } from './PartnerDossier'
import { LeagueDossier } from './LeagueDossier'
import { GenericEntityDossier } from './GenericEntityDossier'
import { EnhancedClubDossier } from './EnhancedClubDossier'
import { EnhancedPersonDossier } from './EnhancedPersonDossier'
import { EnhancedArsenalDossier } from './EnhancedArsenalDossier'
import { Button } from '@/components/ui/button'
import { Zap, Eye } from 'lucide-react'

interface EntityDossierRouterProps {
  entity: Entity
  onEmailEntity: () => void
  dossier?: any
}

export function EntityDossierRouter({ entity, onEmailEntity, dossier }: EntityDossierRouterProps) {
  const [useEnhancedView, setUseEnhancedView] = useState(true) // Default to enhanced view
  const entityType = detectEntityType(entity)
  
  console.log(`Rendering ${useEnhancedView ? 'enhanced' : 'standard'} dossier for entity: ${entity.properties.name}, type: ${entityType}`)
  
  // Render enhanced dossier when available
  if (useEnhancedView) {
    // Special case for Arsenal
    if (entityType === 'Club' && entity.properties.name === 'Arsenal') {
      return (
        <div>
          {/* View Toggle */}
          <div className="flex justify-end mb-4">
            <Button
              variant={useEnhancedView ? "default" : "outline"}
              size="sm"
              onClick={() => setUseEnhancedView(!useEnhancedView)}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {useEnhancedView ? 'Enhanced View' : 'Standard View'}
            </Button>
          </div>
          <EnhancedArsenalDossier entity={entity} onEmailEntity={onEmailEntity} />
        </div>
      )
    }
    
    switch (entityType) {
      case 'Club':
        return (
          <div>
            {/* View Toggle */}
            <div className="flex justify-end mb-4">
              <Button
                variant={useEnhancedView ? "default" : "outline"}
                size="sm"
                onClick={() => setUseEnhancedView(!useEnhancedView)}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {useEnhancedView ? 'Enhanced View' : 'Standard View'}
              </Button>
            </div>
            <EnhancedClubDossier key={`enhanced-${entity.id}-${dossier ? 'with-dossier' : 'no-dossier'}`} entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
          </div>
        )
      case 'Person':
        return (
          <div>
            {/* View Toggle */}
            <div className="flex justify-end mb-4">
              <Button
                variant={useEnhancedView ? "default" : "outline"}
                size="sm"
                onClick={() => setUseEnhancedView(!useEnhancedView)}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {useEnhancedView ? 'Enhanced View' : 'Standard View'}
              </Button>
            </div>
            <EnhancedPersonDossier key={`enhanced-${entity.id}-${dossier ? 'with-dossier' : 'no-dossier'}`} entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
          </div>
        )
      default:
        // Fall back to standard view for other entity types
        setUseEnhancedView(false)
        break
    }
  }
  
  // Standard dossier view with toggle option
  // Special case for Arsenal
  if (entityType === 'Club' && entity.properties.name === 'Arsenal') {
    return (
      <div>
        {/* View Toggle - show enhanced option for Arsenal */}
        <div className="flex justify-end mb-4">
          <Button
            variant={useEnhancedView ? "default" : "outline"}
            size="sm"
            onClick={() => setUseEnhancedView(!useEnhancedView)}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {useEnhancedView ? 'Enhanced View' : 'Standard View'}
          </Button>
        </div>
        <EnhancedArsenalDossier entity={entity} onEmailEntity={onEmailEntity} />
      </div>
    )
  }

  switch (entityType) {
    case 'Club':
      return (
        <div>
          {/* View Toggle - show enhanced option for clubs */}
          <div className="flex justify-end mb-4">
            <Button
              variant={useEnhancedView ? "default" : "outline"}
              size="sm"
              onClick={() => setUseEnhancedView(!useEnhancedView)}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {useEnhancedView ? 'Enhanced View' : 'Standard View'}
            </Button>
          </div>
          <ClubDossier entity={entity} onEmailEntity={onEmailEntity} />
        </div>
      )
    case 'Person':
      return (
        <div>
          {/* View Toggle - show enhanced option for people */}
          <div className="flex justify-end mb-4">
            <Button
              variant={useEnhancedView ? "default" : "outline"}
              size="sm"
              onClick={() => setUseEnhancedView(!useEnhancedView)}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {useEnhancedView ? 'Enhanced View' : 'Standard View'}
            </Button>
          </div>
          <PersonDossier entity={entity} onEmailEntity={onEmailEntity} />
        </div>
      )
    case 'Partner':
    case 'Organization':
      return <PartnerDossier entity={entity} onEmailEntity={onEmailEntity} />
    case 'League':
      return <LeagueDossier entity={entity} onEmailEntity={onEmailEntity} />
    default:
      return <GenericEntityDossier entity={entity} onEmailEntity={onEmailEntity} />
  }
}

export default EntityDossierRouter