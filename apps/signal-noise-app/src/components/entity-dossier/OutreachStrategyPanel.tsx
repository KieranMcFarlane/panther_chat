"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, CheckCircle2, Target, MessageSquare, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Type Definitions
// =============================================================================

export interface Entity {
  id: string;
  type: string;
  name: string;
  metadata: Record<string, any>;
}

export interface DossierData {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  priority_score: number;
  tier: string;
  sections: any[];
  generated_at: string;
  total_cost_usd: number;
  generation_time_seconds: number;
  cache_status: string;
}

export interface Hypothesis {
  id: string;
  category: string;
  description: string;
  status: string;
  confidence: number;
  evidence_count: number;
}

export interface Signal {
  id: string;
  type: string;
  subtype: string;
  confidence: number;
  first_seen: string;
  entity_id: string;
  evidence: any[];
}

export interface LinkedInData {
  profile_url?: string;
  company_size?: string;
  industry?: string;
  headquarters?: string;
  website?: string;
  recent_posts?: number;
  follower_count?: number;
}

export interface OutreachIntelligence {
  anti_patterns: string[];
  recommended_approaches: Array<{
    id: string;
    name: string;
    description: string;
    suitability_score: number;
    reasoning: string;
    talking_points: string[];
    risk_factors: string[];
  }>;
  best_contact_channels: string[];
  optimal_timing: string;
  personalization_tokens: string[];
  confidence_threshold: number;
}

export interface OutreachStrategyPanelProps {
  entity: Entity;
  dossier: DossierData | null;
  hypotheses: Hypothesis[];
  signals: Signal[];
  linkedInData: LinkedInData | null;
  onApproveOutreach: (strategy: OutreachStrategy) => void;
}

export interface OutreachStrategy {
  selectedApproach: string;
  message: string;
  intelligence: OutreachIntelligence;
  approvedAt: Date;
  approvedBy: string;
}

// =============================================================================
// Placeholder Components (to be implemented separately)
// =============================================================================

interface StrategyReasoningProps {
  intelligence: OutreachIntelligence;
  signals: Signal[];
  hypotheses: Hypothesis[];
}

function StrategyReasoning({ intelligence, signals, hypotheses }: StrategyReasoningProps) {
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Brain className="h-5 w-5" />
        Strategy Reasoning
      </h3>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">AI analysis based on {signals.length} signals and {hypotheses.length} hypotheses</p>
        {intelligence.anti_patterns.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-red-600 mb-2">Anti-Patterns Detected:</p>
            <ul className="text-sm space-y-1">
              {intelligence.anti_patterns.map((pattern, i) => (
                <li key={i} className="text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {pattern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface ApproachDeciderProps {
  approaches: OutreachIntelligence["recommended_approaches"];
  selectedApproach: string | null;
  onSelectApproach: (approachId: string) => void;
}

function ApproachDecider({ approaches, selectedApproach, onSelectApproach }: ApproachDeciderProps) {
  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Target className="h-5 w-5" />
        Decide Approach
      </h3>
      <div className="space-y-3">
        {approaches.map((approach) => (
          <Card
            key={approach.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedApproach === approach.id && "ring-2 ring-primary"
            )}
            onClick={() => onSelectApproach(approach.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{approach.name}</h4>
                <Badge variant={approach.suitability_score > 0.7 ? "default" : "secondary"}>
                  {Math.round(approach.suitability_score * 100)}%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{approach.description}</p>
              <p className="text-xs text-muted-foreground italic">{approach.reasoning}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface MessageComposerProps {
  selectedApproach: string | null;
  approaches: OutreachIntelligence["recommended_approaches"];
  intelligence: OutreachIntelligence;
  message: string;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  isSending: boolean;
}

function MessageComposer({
  selectedApproach,
  approaches,
  intelligence,
  message,
  onMessageChange,
  onSend,
  isSending
}: MessageComposerProps) {
  const selectedApproachData = approaches.find((a) => a.id === selectedApproach);

  if (!selectedApproach) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground text-center">
          Select an approach from the center panel to compose your message
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 h-full flex flex-col">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Write Message
      </h3>

      <div className="flex-1 space-y-4 overflow-auto">
        {selectedApproachData && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Talking Points:</p>
              <ul className="text-sm space-y-1">
                {selectedApproachData.talking_points.map((point, i) => (
                  <li key={i} className="text-muted-foreground">• {point}</li>
                ))}
              </ul>
            </div>

            {selectedApproachData.risk_factors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1 text-red-600">Risk Factors:</p>
                <ul className="text-sm space-y-1">
                  {selectedApproachData.risk_factors.map((risk, i) => (
                    <li key={i} className="text-red-700">• {risk}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Personalization Tokens:</p>
              <div className="flex flex-wrap gap-1">
                {intelligence.personalization_tokens.map((token, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {token}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Your Message:</label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Compose your outreach message using the talking points above..."
            className="w-full min-h-[200px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <Button
        onClick={onSend}
        disabled={!message.trim() || isSending}
        className="w-full"
      >
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve & Send
          </>
        )}
      </Button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function OutreachStrategyPanel({
  entity,
  dossier,
  hypotheses,
  signals,
  linkedInData,
  onApproveOutreach
}: OutreachStrategyPanelProps) {
  const [intelligence, setIntelligence] = useState<OutreachIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Fetch outreach intelligence
  useEffect(() => {
    const fetchIntelligence = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/outreach-intelligence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entity_id: entity.id,
            signals: signals,
            hypotheses: hypotheses,
            linkedin_data: linkedInData,
            dossier_data: dossier
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setIntelligence(data);

        // Pre-select the best approach
        if (data.recommended_approaches.length > 0) {
          const bestApproach = data.recommended_approaches.reduce((best: any, current: any) =>
            current.suitability_score > best.suitability_score ? current : best
          );
          setSelectedApproach(bestApproach.id);
        }

      } catch (err) {
        console.error("Failed to fetch outreach intelligence:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchIntelligence();
  }, [entity.id, signals, hypotheses, linkedInData, dossier]);

  const handleApproveOutreach = async () => {
    if (!intelligence || !selectedApproach || !message.trim()) {
      return;
    }

    setIsSending(true);

    try {
      const strategy: OutreachStrategy = {
        selectedApproach,
        message,
        intelligence,
        approvedAt: new Date(),
        approvedBy: "user", // TODO: Get from auth context
      };

      await onApproveOutreach(strategy);
      setMessage("");
    } catch (err) {
      console.error("Failed to approve outreach:", err);
      setError(err instanceof Error ? err.message : "Failed to send outreach");
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Analyzing outreach strategy...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !intelligence) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full py-12">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="font-semibold text-lg mb-2">Failed to Load Strategy</h3>
            <p className="text-muted-foreground mb-4">{error || "Unknown error"}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state - three-panel layout
  return (
    <div className="h-full">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Outreach Strategy: {entity.name}</span>
            <Badge variant="outline">
              {intelligence.recommended_approaches.length} Approaches
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Three-panel layout */}
      <div className="grid grid-cols-3 gap-4 h-[calc(100%-80px)]">
        {/* Left Panel: Strategy Reasoning */}
        <Card className="h-full overflow-auto">
          <StrategyReasoning
            intelligence={intelligence}
            signals={signals}
            hypotheses={hypotheses}
          />
        </Card>

        {/* Center Panel: Approach Decider */}
        <Card className="h-full overflow-auto">
          <ApproachDecider
            approaches={intelligence.recommended_approaches}
            selectedApproach={selectedApproach}
            onSelectApproach={setSelectedApproach}
          />
        </Card>

        {/* Right Panel: Message Composer */}
        <Card className="h-full overflow-auto">
          <MessageComposer
            selectedApproach={selectedApproach}
            approaches={intelligence.recommended_approaches}
            intelligence={intelligence}
            message={message}
            onMessageChange={setMessage}
            onSend={handleApproveOutreach}
            isSending={isSending}
          />
        </Card>
      </div>

      {/* Anti-pattern warnings */}
      {intelligence.anti_patterns.length > 0 && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> {intelligence.anti_patterns.length} anti-pattern(s) detected.
            Review the Strategy Reasoning panel before proceeding.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
