"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building, Download, FileText, Mail, ExternalLink } from "lucide-react"

import { Entity, formatValue } from './types'

interface PartnerDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

export function PartnerDossier({ entity, onEmailEntity }: PartnerDossierProps) {
  const props = entity.properties
  
  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'P'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Building className="h-6 w-6 text-blue-600" />
                  {props.name || 'Partner Organization'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Technology Partner</span>
                  <span>{props.industry || 'Technology'}</span>
                  <span>{props.headquarters || 'Global'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-medium">
                PARTNER
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
          <CardTitle>Partner Organization Dossier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Organization Overview</h4>
              <p className="text-muted-foreground">
                {formatValue(props.description) || 'Organization information and partnership details.'}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Partnership Focus</h4>
              <p className="text-muted-foreground">
                {formatValue(props.partnershipFocus) || 'Technology and innovation partnerships.'}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Key Services</h4>
              <p className="text-muted-foreground">
                {formatValue(props.keyServices) || 'Digital transformation and technology solutions.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}