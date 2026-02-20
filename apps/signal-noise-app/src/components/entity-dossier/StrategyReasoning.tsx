'use client';

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  FileText,
  Shield,
  Zap,
  MessageSquare,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface LinkedInPost {
  id: string;
  text: string;
  postedAt: string;
  engagement?: number;
}

interface Connection {
  mutuals?: number;
  strongestPath?: string;
  approachType: 'warm' | 'lukewarm' | 'cold';
}

interface AntiPattern {
  type: 'generic_template' | 'cold_approach_timing' | 'vendor_lock_in';
  severity: 'high' | 'medium' | 'low';
  message: string;
  fix: string;
}

interface OpportunityAssessment {
  signalType: 'procurement' | 'capability' | 'none';
  confidence: number;
  timeline: string;
  rationale: string;
}

interface StrategyReasoningProps {
  opportunity: OpportunityAssessment;
  connections: Connection;
  recentPosts?: LinkedInPost[];
  antiPatterns?: AntiPattern[];
  digitalMaturityScore?: number;
  currentSatisfaction?: number;
}

const StrategyReasoning: React.FC<StrategyReasoningProps> = ({
  opportunity,
  connections,
  recentPosts = [],
  antiPatterns = [],
  digitalMaturityScore = 0,
  currentSatisfaction = 0
}) => {
  const getSignalIcon = () => {
    switch (opportunity.signalType) {
      case 'procurement':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'capability':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getApproachBadge = () => {
    switch (connections.approachType) {
      case 'warm':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Users className="w-3 h-3 mr-1" />
            Warm Approach
          </span>
        );
      case 'lukewarm':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Users className="w-3 h-3 mr-1" />
            Lukewarm
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Shield className="w-3 h-3 mr-1" />
            Cold Approach
          </span>
        );
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Opportunity Assessment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          {getSignalIcon()}
          <span className="ml-2">Opportunity Assessment</span>
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Signal Type</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
              {opportunity.signalType === 'procurement' ? 'Procurement Signal' : 'Capability Signal'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Confidence</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {(opportunity.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Timeline</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {opportunity.timeline}
            </span>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">{opportunity.rationale}</p>
          </div>
        </div>
      </div>

      {/* Connection Intelligence */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Users className="w-5 h-5 text-blue-500" />
          <span className="ml-2">Connection Intelligence</span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Approach Type</span>
            {getApproachBadge()}
          </div>

          {connections.mutuals !== undefined && connections.mutuals > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Mutual Connections</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {connections.mutuals} people
              </span>
            </div>
          )}

          {connections.strongestPath && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Strongest Path</p>
              <p className="text-sm text-gray-900 dark:text-white">{connections.strongestPath}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Context */}
      {recentPosts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            <span className="ml-2">Recent Context</span>
          </h3>

          <div className="space-y-3">
            {recentPosts.slice(0, 3).map((post) => (
              <div key={post.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {truncateText(post.text)}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{new Date(post.postedAt).toLocaleDateString()}</span>
                  {post.engagement && (
                    <span className="flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {post.engagement} engagement
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anti-Pattern Warnings */}
      {antiPatterns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="ml-2">Anti-Pattern Warnings</span>
          </h3>

          <div className="space-y-3">
            {antiPatterns.map((pattern, index) => (
              <div
                key={index}
                className={`p-4 rounded-md border-l-4 ${getSeverityColor(pattern.severity)}`}
              >
                <div className="flex items-start">
                  <AlertCircle className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                    pattern.severity === 'high' ? 'text-red-500' :
                    pattern.severity === 'medium' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {pattern.message}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-medium">Fix:</span> {pattern.fix}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyReasoning;
