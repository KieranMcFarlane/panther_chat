"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database, Download, FileText, Mail, ExternalLink } from "lucide-react"

import { Entity, formatValue } from './types'

interface GenericEntityDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier?: any
}

export function GenericEntityDossier({ entity, onEmailEntity, dossier }: GenericEntityDossierProps) {
  const props = entity.properties
  const dossierMetadata = dossier?.metadata || dossier || {}
  const browserDossierUrl = dossierMetadata.browser_dossier_url || dossierMetadata.page_url || ''
  const sourceUrl = dossierMetadata.source_url || ''
  const signalState = dossierMetadata.signal_state || 'monitor_no_opportunity'
  const opportunityScore = dossierMetadata.opportunity_score
  const rfpConfidence = dossierMetadata.rfp_confidence

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'E'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Database className="h-6 w-6 text-gray-600" />
                  {props.name || 'Entity'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{props.type || 'Entity'}</span>
                  <span>{props.category || 'General'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-gray-100 text-gray-800 border-gray-200 font-medium">
                ENTITY
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entity Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Overview</h4>
              <p className="text-muted-foreground">
                {formatValue(props.description) || 'Entity information and details.'}
              </p>
            </div>
            
            {Object.entries(props).map(([key, value]) => {
              if (!['name', 'description', 'type', 'dossier_data'].includes(key) && value) {
                return (
                  <div key={key}>
                    <h4 className="font-semibold mb-2 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <p className="text-muted-foreground">
                      {formatValue(value)}
                    </p>
                  </div>
                )
              }
              return null
            })}
          </div>
        </CardContent>
      </Card>

      {dossier && (
        <Card>
          <CardHeader>
            <CardTitle>Dossier References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {browserDossierUrl && (
                <div>
                  <h4 className="font-semibold mb-1">Dossier Page</h4>
                  <a href={browserDossierUrl} className="text-blue-600 hover:underline break-all" target="_blank" rel="noreferrer">
                    {browserDossierUrl}
                  </a>
                </div>
              )}
              {sourceUrl && (
                <div>
                  <h4 className="font-semibold mb-1">Source URL</h4>
                  <a href={sourceUrl} className="text-blue-600 hover:underline break-all" target="_blank" rel="noreferrer">
                    {sourceUrl}
                  </a>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Signal State: {signalState}</Badge>
              {typeof opportunityScore === 'number' && <Badge variant="outline">Opportunity: {opportunityScore}/100</Badge>}
              {typeof rfpConfidence === 'number' && <Badge variant="outline">RFP Confidence: {Math.round(rfpConfidence * 100)}%</Badge>}
            </div>
            {dossierMetadata.decision_summary && (
              <p className="text-sm text-muted-foreground">{dossierMetadata.decision_summary}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
