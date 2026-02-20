"use client";

import { useState } from "react";
import { MessageSquare, Mail, Send, AlertTriangle, ChevronRight, ChevronDown, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// =============================================================================
// Type Definitions
// =============================================================================

export interface FollowUpStrategy {
  message: string;
  timing: string;
  channel: "email" | "linkedin" | "phone";
  goal: string;
}

export interface ResponseBranch {
  response_type: "interested" | "neutral" | "negative" | "questioning";
  probability: number;
  follow_up_strategy: FollowUpStrategy;
}

export interface OpeningMessage {
  subject_line: string;
  body: string;
  personalization_tokens: string[];
  expected_response_rate: number;
}

export interface ConversationTree {
  scenario: string;
  opening_message: OpeningMessage;
  response_branches: ResponseBranch[];
  depth: number;
  success_criteria: string;
  anti_patterns: string[];
}

interface ConversationTreeViewerProps {
  tree: ConversationTree;
  onSendMessage?: (message: string, channel: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getBranchVariant(responseType: string): "default" | "secondary" | "destructive" | "outline" {
  switch (responseType) {
    case "interested":
      return "default";
    case "neutral":
      return "secondary";
    case "negative":
      return "destructive";
    case "questioning":
      return "outline";
    default:
      return "secondary";
  }
}

function getBranchColor(responseType: string): string {
  switch (responseType) {
    case "interested":
      return "border-green-500 bg-green-50 dark:bg-green-900/20";
    case "neutral":
      return "border-gray-500 bg-gray-50 dark:bg-gray-900/20";
    case "negative":
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    case "questioning":
      return "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
    default:
      return "border-gray-400 bg-gray-50 dark:bg-gray-900/20";
  }
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "email":
      return <Mail className="h-3 w-3" />;
    case "linkedin":
      return <Users className="h-3 w-3" />;
    case "phone":
      return <MessageSquare className="h-3 w-3" />;
    default:
      return <Send className="h-3 w-3" />;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function ConversationTreeViewer({ tree, onSendMessage }: ConversationTreeViewerProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["opening", "branches"]));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="conversation-tree space-y-4">
      {/* Scenario Header */}
      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
        <h4 className="font-semibold text-lg text-primary">{tree.scenario}</h4>
        <Badge variant="outline">Depth: {tree.depth} turns</Badge>
      </div>

      {/* Opening Message */}
      <Card className={cn(
        "transition-all",
        expandedSections.has("opening") ? "opacity-100" : "opacity-50"
      )}>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("opening")}
          >
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>Opening Message</span>
            </div>
            {expandedSections.has("opening") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>
        {expandedSections.has("opening") && (
          <CardContent className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Subject:</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">{tree.opening_message.subject_line}</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-md">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Body:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{tree.opening_message.body}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {tree.opening_message.personalization_tokens.map((token, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {token}
                  </Badge>
                ))}
              </div>
              <Badge variant="default">
                Expected Response: {tree.opening_message.expected_response_rate}%
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Response Branches */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("branches")}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span>Response Branches</span>
              <Badge variant="secondary">{tree.response_branches.length} options</Badge>
            </div>
            {expandedSections.has("branches") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>

        {expandedSections.has("branches") && (
          <CardContent className="space-y-3">
            {tree.response_branches.map((branch, idx) => (
              <div
                key={idx}
                className={cn(
                  "tree-node branch border-l-4 rounded-md transition-all cursor-pointer",
                  getBranchColor(branch.response_type),
                  selectedBranch === idx ? "ring-2 ring-primary" : ""
                )}
                onClick={() => setSelectedBranch(selectedBranch === idx ? null : idx)}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={getBranchVariant(branch.response_type)} className="capitalize">
                      {branch.response_type}
                    </Badge>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {branch.probability}% likely
                    </span>
                  </div>

                  {selectedBranch === idx && (
                    <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Follow-up Message:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          {branch.follow_up_strategy.message}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            🕐 {branch.follow_up_strategy.timing}
                          </span>
                          <span className="flex items-center gap-1">
                            📡 {getChannelIcon(branch.follow_up_strategy.channel)}
                            {branch.follow_up_strategy.channel}
                          </span>
                          <span className="flex items-center gap-1">
                            🎯 {branch.follow_up_strategy.goal}
                          </span>
                        </div>

                        {onSendMessage && (
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSendMessage(branch.follow_up_strategy.message, branch.follow_up_strategy.channel);
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send {branch.follow_up_strategy.channel}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Success Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Success Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300">{tree.success_criteria}</p>
        </CardContent>
      </Card>

      {/* Anti-Patterns */}
      {tree.anti_patterns.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <strong className="block">Avoid These Mistakes:</strong>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {tree.anti_patterns.map((pattern, idx) => (
                  <li key={idx}>{pattern}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// =============================================================================
// Multiple Trees Viewer
// =============================================================================

interface ConversationTreesViewerProps {
  trees: ConversationTree[];
  onSendMessage?: (message: string, channel: string) => void;
}

export function ConversationTreesViewer({ trees, onSendMessage }: ConversationTreesViewerProps) {
  const [activeTreeIndex, setActiveTreeIndex] = useState(0);

  return (
    <div className="conversation-trees-viewer space-y-6">
      {/* Tree Selector */}
      <div className="flex flex-wrap gap-2">
        {trees.map((tree, idx) => (
          <Button
            key={idx}
            variant={activeTreeIndex === idx ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTreeIndex(idx)}
          >
            {tree.scenario}
          </Button>
        ))}
      </div>

      {/* Active Tree */}
      {trees.length > 0 && (
        <ConversationTreeViewer
          tree={trees[activeTreeIndex]}
          onSendMessage={onSendMessage}
        />
      )}
    </div>
  );
}
