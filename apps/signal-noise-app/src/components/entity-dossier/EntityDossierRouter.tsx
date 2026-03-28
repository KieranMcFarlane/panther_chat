"use client"

import { Entity, detectEntityType } from './types'
import { PartnerDossier } from './PartnerDossier'
import { LeagueDossier } from './LeagueDossier'
import { GenericEntityDossier } from './GenericEntityDossier'
import { EnhancedClubDossier } from './EnhancedClubDossier'
import { EnhancedPersonDossier } from './EnhancedPersonDossier'
import { FinalRalphClubDossier } from './FinalRalphClubDossier'

interface EntityDossierRouterProps {
  entity: Entity
  onEmailEntity: () => void
  dossier?: any
}

export function EntityDossierRouter({ entity, onEmailEntity, dossier }: EntityDossierRouterProps) {
  const entityType = detectEntityType(entity)

  console.log(`Rendering dossier for entity: ${entity.properties.name}, type: ${entityType}`)

  switch (entityType) {
    case 'Club':
      return dossier ? (
        <FinalRalphClubDossier
          key={`final-ralph-${entity.id}`}
          entity={entity}
          onEmailEntity={onEmailEntity}
          dossier={dossier}
        />
      ) : (
        <EnhancedClubDossier key={`enhanced-${entity.id}-no-dossier`} entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
      )
    case 'Person':
      return <EnhancedPersonDossier key={`enhanced-${entity.id}-${dossier ? 'with-dossier' : 'no-dossier'}`} entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
    case 'Partner':
    case 'Organization':
      return <PartnerDossier entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
    case 'League':
      return <LeagueDossier entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
    default:
      return <GenericEntityDossier entity={entity} onEmailEntity={onEmailEntity} dossier={dossier} />
  }
}

export default EntityDossierRouter
