"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, Users, Target, AlertTriangle, Calendar, DollarSign, BarChart3, Shield, Lightbulb, Phone, Mail, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Enhanced interfaces for structured dossier data
interface DossierInsight {
  text: string;
  confidence: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
}

interface DossierRecommendation {
  action: string;
  timeline: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimated_impact?: string;
  budget_indicator?: string;
}

interface DossierSubsection {
  title: string;
  content: string[];
  metrics?: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'neutral' }>;
  insights?: DossierInsight[];
  recommendations?: DossierRecommendation[];
}

interface DossierSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  subsections: DossierSubsection[];
  overall_score?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Confidence indicator component
const ConfidenceIndicator = ({ confidence }: { confidence: number }) => {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300", getColor(confidence))}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">{confidence}%</span>
    </div>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' }) => {
  const colors = {
    HIGH: "bg-red-100 text-red-800 border-red-200",
    MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
    LOW: "bg-green-100 text-green-800 border-green-200"
  };

  return (
    <span className={cn("px-2 py-1 text-xs font-medium border rounded-full", colors[priority])}>
      {priority}
    </span>
  );
};

// Icon mapping for sections
const getSectionIcon = (sectionId: string) => {
  const icons: Record<string, React.ReactNode> = {
    executive: <Target className="w-4 h-4" />,
    digital: <BarChart3 className="w-4 h-4" />,
    commercial: <DollarSign className="w-4 h-4" />,
    opportunities: <Lightbulb className="w-4 h-4" />,
    leadership: <Users className="w-4 h-4" />,
    risk: <AlertTriangle className="w-4 h-4" />,
    competitive: <TrendingUp className="w-4 h-4" />,
    financial: <BarChart3 className="w-4 h-4" />,
    engagement: <Phone className="w-4 h-4" />
  };
  return icons[sectionId] || <Target className="w-4 h-4" />;
};

// Main accordion item component
interface DossierAccordionItemProps {
  section: DossierSection;
  index: number;
}

const DossierAccordionItem = ({ section, index }: DossierAccordionItemProps) => {
  const [isOpen, setIsOpen] = useState(section.defaultOpen || index === 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                {section.icon || getSectionIcon(section.id)}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
                {section.overall_score && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">Score:</span>
                    <ConfidenceIndicator confidence={section.overall_score} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {section.priority && <PriorityBadge priority={section.priority} />}
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="border-t border-gray-200">
          <div className="p-4 bg-white space-y-6">
            {section.subsections.map((subsection, subIndex) => (
              <SubSectionContent key={subIndex} subsection={subsection} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// Subsection content component
interface SubSectionContentProps {
  subsection: DossierSubsection;
}

const SubSectionContent = ({ subsection }: SubSectionContentProps) => {
  const [isSubOpen, setIsSubOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <Collapsible open={isSubOpen} onOpenChange={setIsSubOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <h4 className="font-medium text-gray-800">{subsection.title}</h4>
            {isSubOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* Metrics */}
            {subsection.metrics && subsection.metrics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subsection.metrics.map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{metric.value}</span>
                      {metric.trend && (
                        <TrendingUp 
                          className={cn(
                            "w-4 h-4",
                            metric.trend === 'up' ? "text-green-500" : 
                            metric.trend === 'down' ? "text-red-500" : "text-gray-400"
                          )} 
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            {subsection.content && subsection.content.length > 0 && (
              <div className="space-y-2">
                {subsection.content.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Insights */}
            {subsection.insights && subsection.insights.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-800 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Key Insights
                </h5>
                {subsection.insights.map((insight, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm text-gray-700 mb-2">{insight.text}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Confidence:</span>
                        <ConfidenceIndicator confidence={insight.confidence} />
                      </div>
                      <PriorityBadge priority={insight.impact} />
                    </div>
                    {insight.source && (
                      <p className="text-xs text-gray-500 mt-2">Source: {insight.source}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {subsection.recommendations && subsection.recommendations.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-medium text-gray-800 flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-500" />
                  Recommendations
                </h5>
                {subsection.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-green-50 border border-green-100 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-gray-700 font-medium">{rec.action}</p>
                      <PriorityBadge priority={rec.priority} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{rec.timeline}</span>
                      </div>
                      {rec.budget_indicator && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          <span>{rec.budget_indicator}</span>
                        </div>
                      )}
                    </div>
                    {rec.estimated_impact && (
                      <p className="text-xs text-gray-600 mt-2">Expected Impact: {rec.estimated_impact}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// Main accordion component
interface DossierAccordionProps {
  sections: DossierSection[];
  className?: string;
}

export const DossierAccordion = ({ sections, className }: DossierAccordionProps) => {
  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => (
        <DossierAccordionItem 
          key={section.id} 
          section={section} 
          index={index} 
        />
      ))}
    </div>
  );
};

// Export types for external use
export type { 
  DossierSection, 
  DossierSubsection, 
  DossierInsight, 
  DossierRecommendation 
};
export { DossierAccordionItem, SubSectionContent };