/**
 * 🔍 RFP Detail Modal
 * 
 * Displays comprehensive details about an RFP detection in a modal overlay
 */

'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  MapPin, 
  PoundSterling, 
  Calendar, 
  ExternalLink, 
  Clock,
  Target,
  Brain,
  Trophy,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Globe,
  FileText,
  TrendingUp,
  Users,
  Mail,
  Phone,
  MessageSquare,
  Star,
  Activity,
  BarChart3,
  Eye,
  Share2,
  Download
} from 'lucide-react';

interface RFPDetection {
  id: string;
  title: string;
  description: string;
  organization: string;
  location?: string;
  value?: string;
  deadline?: string;
  published?: string;
  source: string;
  source_url: string;
  category: string;
  status: 'detected' | 'analyzing' | 'qualified' | 'responded' | 'rejected';
  type: string;
  confidence: number;
  yellow_panther_fit: number;
  priority_score: number;
  detected_at: string;
  entity_id?: string;
  entity_name?: string;
  contact_info?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  requirements?: string[];
  evaluation_criteria?: string[];
  timeline?: {
    submission_deadline?: string;
    evaluation_period?: string;
    award_date?: string;
  };
  competition?: Array<{
    name: string;
    strength: string;
  }>;
  key_stakeholders?: Array<{
    name: string;
    role: string;
  }>;
  next_steps?: string[];
  internal_notes?: string;
  tags?: string[];
}

interface RFPDetailModalProps {
  detection: RFPDetection | null;
  open: boolean;
  onClose: () => void;
}

export default function RFPDetailModal({ detection, open, onClose }: RFPDetailModalProps) {
  if (!detection) return null;

  const getFitColor = (fit: number) => {
    if (fit >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (fit >= 80) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'qualified': return 'text-green-600 bg-green-50 border-green-200';
      case 'analyzing': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'detected': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'responded': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatConfidence = (confidence: number) => {
    return Math.round(confidence * 100);
  };

  const getDaysUntilDeadline = (deadline: string | undefined) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const daysUntilDeadline = getDaysUntilDeadline(detection.deadline);
  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Brain className="w-6 h-6 text-primary" />
            RFP Opportunity Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Section */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-3 pr-4">{detection.title}</h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                  <Building2 className="w-4 h-4" />
                  <span className="font-medium">{detection.organization}</span>
                  {detection.location && (
                    <>
                      <MapPin className="w-4 h-4 ml-2" />
                      <span>{detection.location}</span>
                    </>
                  )}
                </div>
                {detection.entity_name && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                    <Database className="w-4 h-4" />
                    <span>Entity: {detection.entity_name}</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <Badge className={`${getStatusColor(detection.status)} border`}>
                  {detection.status}
                </Badge>
                <Badge className={`${getFitColor(detection.yellow_panther_fit)} border font-semibold`}>
                  {detection.yellow_panther_fit}% Fit
                </Badge>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Brain className="w-5 h-5 mx-auto mb-1 text-primary" />
                <div className="text-lg font-bold">{formatConfidence(detection.confidence)}%</div>
                <div className="text-xs text-muted-foreground">Confidence</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Target className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                <div className="text-lg font-bold">{detection.priority_score}/10</div>
                <div className="text-xs text-muted-foreground">Priority</div>
              </div>
              {detection.value && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <PoundSterling className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <div className="text-lg font-bold">{detection.value}</div>
                  <div className="text-xs text-muted-foreground">Value</div>
                </div>
              )}
              {detection.deadline && (
                <div className={`text-center p-3 rounded-lg ${isUrgent ? 'bg-red-50' : 'bg-muted/50'}`}>
                  <Clock className={`w-5 h-5 mx-auto mb-1 ${isUrgent ? 'text-red-600' : ''}`} />
                  <div className={`text-lg font-bold ${isUrgent ? 'text-red-600' : ''}`}>
                    {daysUntilDeadline !== null && daysUntilDeadline > 0 ? `${daysUntilDeadline}d` : 'Expired'}
                  </div>
                  <div className="text-xs text-muted-foreground">Until Deadline</div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Opportunity Description
            </h3>
            <p className="text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-lg">
              {detection.description}
            </p>
          </div>

          {/* Categorization */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Classification
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-sm">{detection.category}</Badge>
              <Badge variant="outline" className="text-sm">{detection.type}</Badge>
              <Badge variant="outline" className="text-sm">Source: {detection.source}</Badge>
              {detection.tags?.map(tag => (
                <Badge key={tag} variant="secondary" className="text-sm">{tag}</Badge>
              ))}
            </div>
          </div>

          {/* Timeline Information */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Timeline Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Published:</span> {detection.published ? formatDate(detection.published) : 'Not specified'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Detected:</span> {formatDate(detection.detected_at)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Deadline:</span> {detection.deadline ? formatDate(detection.deadline) : 'Not specified'}
                </div>
                {detection.timeline && (
                  <div className="text-sm">
                    <span className="font-medium">Evaluation Period:</span> {detection.timeline.evaluation_period || 'Not specified'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Requirements (if available) */}
          {detection.requirements && detection.requirements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Star className="w-5 h-5" />
                Key Requirements
              </h3>
              <ul className="space-y-2">
                {detection.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluation Criteria (if available) */}
          {detection.evaluation_criteria && detection.evaluation_criteria.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Evaluation Criteria
              </h3>
              <ul className="space-y-2">
                {detection.evaluation_criteria.map((criteria, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{criteria}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Competition (if available) */}
          {detection.competition && detection.competition.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Known Competition
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detection.competition.map((competitor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="font-medium text-sm">{competitor.name}</span>
                    <Badge variant="outline" className="text-xs">{competitor.strength}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact Information (if available) */}
          {detection.contact_info && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
                {detection.contact_info.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${detection.contact_info.email}`} className="text-primary hover:underline">
                      {detection.contact_info.email}
                    </a>
                  </div>
                )}
                {detection.contact_info.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${detection.contact_info.phone}`} className="text-primary hover:underline">
                      {detection.contact_info.phone}
                    </a>
                  </div>
                )}
                {detection.contact_info.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4" />
                    <a href={detection.contact_info.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Steps (if available) */}
          {detection.next_steps && detection.next_steps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recommended Next Steps
              </h3>
              <ol className="space-y-2">
                {detection.next_steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Internal Notes (if available) */}
          {detection.internal_notes && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Internal Notes
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">{detection.internal_notes}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
            
            <div className="flex gap-2">
              {detection.source_url && (
                <Button variant="outline" asChild>
                  <a 
                    href={detection.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Source
                  </a>
                </Button>
              )}
              
              <Button className="bg-primary hover:bg-primary/90">
                <Eye className="w-4 h-4 mr-2" />
                Full Analysis
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}