/**
 * Approach Decider Component
 *
 * Displays and manages sales approach options for entity outreach.
 * Automatically generates 3 approach options based on available data:
 * - Warm Introduction (if mutuals available)
 * - Post-Based Outreach (if recent relevant posts)
 * - Direct Cold Outreach (fallback)
 *
 * Features:
 * - Dynamic approach generation with anti-pattern detection
 * - Confidence-based recommendation highlighting
 * - Clickable card selection UI
 * - Steps preview and timeline visualization
 */

"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ArrowRight, Users, MessageSquare, Mail, AlertTriangle } from 'lucide-react';

/**
 * Represents a single outreach approach option
 */
export interface ApproachOption {
  id: string;
  title: string;
  description: string;
  type: 'warm_introduction' | 'post_based' | 'cold_outreach';
  confidence: number; // 0-1 scale
  timeline: string;
  advantages: string[];
  steps: string[];
  antiPatterns?: string[]; // Warnings about what to avoid
  available: boolean; // Whether this approach is viable
  reason?: string; // Why this approach may not be available
}

export interface ApproachDeciderProps {
  approaches?: ApproachOption[];
  onSelect?: (approach: ApproachOption) => void;
  selectedApproachId?: string;
  entityId?: string;
  entityName?: string;
  mutualConnections?: number;
  recentPostCount?: number;
}

/**
 * Generates default approaches based on available data
 */
function generateDefaultApproaches(props: ApproachDeciderProps): ApproachOption[] {
  const {
    mutualConnections = 0,
    recentPostCount = 0,
    entityName = 'this entity'
  } = props;

  const approaches: ApproachOption[] = [];

  // Warm Introduction (only if mutuals available)
  if (mutualConnections > 0) {
    approaches.push({
      id: 'warm-intro',
      title: 'Warm Introduction',
      description: `Leverage ${mutualConnections} mutual connection${mutualConnections > 1 ? 's' : ''} to establish credibility`,
      type: 'warm_introduction',
      confidence: 0.85,
      timeline: '1-2 weeks',
      advantages: [
        'Highest response rate (40-60%)',
        'Immediate trust transfer',
        'Access to decision makers',
        'Natural conversation starter'
      ],
      steps: [
        `Identify strongest mutual connection based on relationship score`,
        `Craft personalized introduction request highlighting mutual value`,
        `Provide connection with talking points and value proposition`,
        'Follow up with thank you and next steps'
      ],
      antiPatterns: [
        'Don\'t ask for introduction without context',
        'Avoid generic connection requests',
        'Never pressure mutual contacts',
        'Don\'t bypass the introduction process'
      ],
      available: true
    });
  }

  // Post-Based Outreach (if recent posts available)
  if (recentPostCount > 0) {
    approaches.push({
      id: 'post-outreach',
      title: 'Post-Based Outreach',
      description: `Engage with ${recentPostCount} recent post${recentPostCount > 1 ? 's' : ''} before pitching`,
      type: 'post_based',
      confidence: 0.72,
      timeline: '2-3 weeks',
      advantages: [
        'Shows genuine interest in their content',
        'Builds familiarity before pitch',
        'Higher response than cold outreach (25-35%)',
        'Provides conversation context'
      ],
      steps: [
        `Identify most relevant recent post (last 30 days)`,
        'Leave thoughtful comment with insight (not just "great post")',
        'Wait 2-3 days for response or engagement',
        'Send follow-up message referencing the discussion'
      ],
      antiPatterns: [
        'Don\'t comment on posts older than 90 days',
        'Avoid generic or spammy comments',
        'Never pitch in the first comment',
        'Don\'t engage with unrelated content just for visibility'
      ],
      available: true
    });
  }

  // Direct Cold Outreach (always available as fallback)
  approaches.push({
    id: 'cold-outreach',
    title: 'Direct Cold Outreach',
    description: 'Personalized direct message based on research and value proposition',
    type: 'cold_outreach',
    confidence: 0.45,
    timeline: '3-4 weeks',
    advantages: [
      'Full control over messaging and timing',
      'Scalable approach',
      'No dependencies on third parties',
      'Can be highly personalized with research'
    ],
    steps: [
      `Research ${entityName}'s recent initiatives and pain points`,
      'Craft hyper-personalized message addressing specific challenges',
      'Send initial message with clear value proposition',
      'Follow up sequence (3-4 touches over 2 weeks)'
    ],
    antiPatterns: [
      'Don\'t use generic templates or bulk messaging',
      'Avoid pitching without understanding their context',
      'Never send messages longer than 150 words',
      'Don\'t follow up more than 4 times'
    ],
    available: true
  });

  return approaches;
}

/**
 * Gets confidence badge color based on score
 */
function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-500/10 text-green-700 border-green-500/20';
  if (confidence >= 0.6) return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
  if (confidence >= 0.4) return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
  return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
}

/**
 * Gets confidence label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High Confidence';
  if (confidence >= 0.6) return 'Moderate Confidence';
  if (confidence >= 0.4) return 'Low Confidence';
  return 'Very Low Confidence';
}

/**
 * Gets icon for approach type
 */
function getApproachIcon(type: ApproachOption['type']) {
  switch (type) {
    case 'warm_introduction':
      return <Users className="h-5 w-5" />;
    case 'post_based':
      return <MessageSquare className="h-5 w-5" />;
    case 'cold_outreach':
      return <Mail className="h-5 w-5" />;
  }
}

export function ApproachDecider({
  approaches: customApproaches,
  onSelect,
  selectedApproachId,
  ...props
}: ApproachDeciderProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedApproachId);

  // Use provided approaches or generate defaults
  const approaches = useMemo(() => {
    return customApproaches || generateDefaultApproaches(props);
  }, [customApproaches, props]);

  // Determine selected approach (controlled or uncontrolled)
  const selectedId = selectedApproachId !== undefined ? selectedApproachId : internalSelectedId;

  // Find highest confidence approach for recommendation
  const recommendedApproach = useMemo(() => {
    return approaches.reduce((highest, current) =>
      current.confidence > highest.confidence ? current : highest
    , approaches[0]);
  }, [approaches]);

  const handleSelect = (approach: ApproachOption) => {
    if (onSelect) {
      onSelect(approach);
    } else {
      setInternalSelectedId(approach.id);
    }
  };

  if (approaches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No outreach approaches available for this entity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold">Outreach Approach Selection</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the most effective approach based on available data and confidence scores
          </p>
        </div>
        {recommendedApproach && (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
            Recommended: {recommendedApproach.title}
          </Badge>
        )}
      </div>

      {/* Approach Cards */}
      <div className="grid grid-cols-1 gap-4">
        {approaches.map((approach) => {
          const isSelected = selectedId === approach.id;
          const isRecommended = approach.id === recommendedApproach.id;

          return (
            <Card
              key={approach.id}
              className={`
                cursor-pointer transition-all duration-200
                ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md hover:border-primary/50'}
                ${isRecommended && !isSelected ? 'ring-1 ring-green-500/30' : ''}
              `}
              onClick={() => handleSelect(approach)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Approach Icon */}
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                    `}>
                      {getApproachIcon(approach.type)}
                    </div>

                    {/* Title and Description */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{approach.title}</CardTitle>
                        {isRecommended && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
                            Recommended
                          </Badge>
                        )}
                        {!approach.available && (
                          <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-700 border-gray-500/20">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {approach.description}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div className="ml-2">
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Confidence Score and Timeline */}
                  <div className="flex items-center gap-3">
                    <Badge className={getConfidenceBadgeColor(approach.confidence)}>
                      {getConfidenceLabel(approach.confidence)} ({Math.round(approach.confidence * 100)}%)
                    </Badge>
                    <Badge variant="outline">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      {approach.timeline}
                    </Badge>
                  </div>

                  {/* Advantages */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Advantages</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {approach.advantages.slice(0, 4).map((advantage, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{advantage}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Steps Preview */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">First Steps</h4>
                    <ol className="space-y-1">
                      {approach.steps.slice(0, 2).map((step, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="font-semibold text-primary min-w-[20px]">{idx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      {approach.steps.length > 2 && (
                        <li className="text-sm text-muted-foreground italic pl-7">
                          + {approach.steps.length - 2} more steps
                        </li>
                      )}
                    </ol>
                  </div>

                  {/* Anti-Patterns Warnings */}
                  {approach.antiPatterns && approach.antiPatterns.length > 0 && (
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                      <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Avoid These Common Mistakes
                      </h4>
                      <ul className="space-y-1">
                        {approach.antiPatterns.map((pattern, idx) => (
                          <li key={idx} className="text-xs text-amber-600 flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{pattern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Unavailable Reason */}
                  {!approach.available && approach.reason && (
                    <div className="rounded-lg bg-gray-500/5 border border-gray-500/20 p-3">
                      <p className="text-sm text-gray-600 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        {approach.reason}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedId && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  Selected: {approaches.find(a => a.id === selectedId)?.title}
                </span>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {Math.round((approaches.find(a => a.id === selectedId)?.confidence || 0) * 100)}% confidence
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ApproachDecider;
