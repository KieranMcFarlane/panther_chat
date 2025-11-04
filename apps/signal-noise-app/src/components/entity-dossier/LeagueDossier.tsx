"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, Download, FileText, Mail, ExternalLink } from "lucide-react"

import { Entity, formatValue } from './types'

interface LeagueDossierProps {
  entity: Entity
  onEmailEntity: () => void
}

export function LeagueDossier({ entity, onEmailEntity }: LeagueDossierProps) {
  const props = entity.properties
  
  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {props.name?.charAt(0) || 'L'}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-orange-600" />
                  {props.name || 'League Entity'}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Governing Body</span>
                  <span>{props.sport || 'Multi-sport'}</span>
                  <span>{props.region || 'International'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 font-medium">
                LEAGUE
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
          <CardTitle>League Intelligence Dossier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">League Overview</h4>
              <p className="text-muted-foreground">
                {formatValue(props.description) || 'League information and governance structure.'}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Member Clubs</h4>
              <p className="text-muted-foreground">
                {formatValue(props.memberCount) || 'Multiple member organizations'}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Commercial Strategy</h4>
              <p className="text-muted-foreground">
                {formatValue(props.commercialStrategy) || 'Media rights and commercial partnerships.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}