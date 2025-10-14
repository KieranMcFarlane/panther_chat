/**
 * 🎯 Action Buttons Component for Professional RFP Dashboard
 * 
 * Interactive buttons for each opportunity with logging and persistence
 */

'use client';

import React, { useState } from 'react';
import { ExternalLink, Eye, Star, MessageSquare, Calendar, Users, AlertCircle, CheckCircle, Clock, Archive, Share2, FileText, Target, TrendingUp } from 'lucide-react';

interface ActionButtonsProps {
  opportunity: any;
  onAction: (action: string, data: any) => void;
  compact?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  opportunity, 
  onAction, 
  compact = false 
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, data: any = {}) => {
    setLoading(action);
    try {
      await onAction(action, {
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        organization: opportunity.organization,
        timestamp: new Date().toISOString(),
        ...data
      });
    } finally {
      setLoading(action);
      setTimeout(() => setLoading(null), 1000);
    }
  };

  const buttonStyle = compact 
    ? "px-2 py-1 text-xs" 
    : "px-3 py-2 text-sm";

  const baseClasses = `
    inline-flex items-center space-x-1 border border-custom-border 
    font-body-medium rounded-md transition-colors
    ${buttonStyle}
    bg-custom-box text-fm-light-grey 
    hover:bg-custom-bg hover:text-fm-white
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fm-yellow
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  if (compact) {
    return (
      <div className="flex items-center space-x-1">
        <button
          onClick={() => handleAction('view_details')}
          disabled={loading === 'view_details'}
          className={baseClasses}
          title="View Details"
        >
          <Eye className="w-3 h-3" />
          {loading === 'view_details' ? '...' : ''}
        </button>
        
        <button
          onClick={() => handleAction('mark_interested')}
          disabled={loading === 'mark_interested'}
          className={baseClasses}
          title="Mark as Interested"
        >
          <Star className="w-3 h-3" />
        </button>
        
        <button
          onClick={() => handleAction('add_notes')}
          disabled={loading === 'add_notes'}
          className={baseClasses}
          title="Add Notes"
        >
          <MessageSquare className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Primary Actions */}
      <button
        onClick={() => handleAction('view_details', { sourceUrl: opportunity.url })}
        disabled={loading === 'view_details'}
        className={baseClasses}
      >
        <ExternalLink className="w-4 h-4" />
        <span>{loading === 'view_details' ? 'Loading...' : 'View Details'}</span>
      </button>

      <button
        onClick={() => handleAction('mark_interested')}
        disabled={loading === 'mark_interested'}
        className={`${baseClasses} ${
          opportunity.userAction === 'interested' 
            ? 'bg-yellow-100 text-yellow-800 border-yellow-300' 
            : ''
        }`}
      >
        <Star className="w-4 h-4" />
        <span>{loading === 'mark_interested' ? '...' : 'Mark Interested'}</span>
      </button>

      {/* Secondary Actions */}
      <button
        onClick={() => handleAction('schedule_followup')}
        disabled={loading === 'schedule_followup'}
        className={baseClasses}
      >
        <Calendar className="w-4 h-4" />
        <span>{loading === 'schedule_followup' ? '...' : 'Schedule Follow-up'}</span>
      </button>

      <button
        onClick={() => handleAction('assign_team')}
        disabled={loading === 'assign_team'}
        className={baseClasses}
      >
        <Users className="w-4 h-4" />
        <span>{loading === 'assign_team' ? '...' : 'Assign Team'}</span>
      </button>

      {/* Analysis Actions */}
      <button
        onClick={() => handleAction('analyze_competitors')}
        disabled={loading === 'analyze_competitors'}
        className={baseClasses}
      >
        <Target className="w-4 h-4" />
        <span>{loading === 'analyze_competitors' ? '...' : 'Analyze Competitors'}</span>
      </button>

      <button
        onClick={() => handleAction('estimate_value')}
        disabled={loading === 'estimate_value'}
        className={baseClasses}
      >
        <TrendingUp className="w-4 h-4" />
        <span>{loading === 'estimate_value' ? '...' : 'Value Analysis'}</span>
      </button>

      {/* Communication Actions */}
      <button
        onClick={() => handleAction('add_notes')}
        disabled={loading === 'add_notes'}
        className={baseClasses}
      >
        <FileText className="w-4 h-4" />
        <span>{loading === 'add_notes' ? '...' : 'Add Notes'}</span>
      </button>

      <button
        onClick={() => handleAction('share_team')}
        disabled={loading === 'share_team'}
        className={baseClasses}
      >
        <Share2 className="w-4 h-4" />
        <span>{loading === 'share_team' ? '...' : 'Share Team'}</span>
      </button>

      {/* Status Actions */}
      <button
        onClick={() => handleAction('archive')}
        disabled={loading === 'archive'}
        className={baseClasses}
      >
        <Archive className="w-4 h-4" />
        <span>{loading === 'archive' ? '...' : 'Archive'}</span>
      </button>
    </div>
  );
};

export default ActionButtons;