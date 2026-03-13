"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { Brain, Database, Trophy, Search, List } from 'lucide-react';

const EnhancedRFPMonitoringDashboard = dynamicImport(() => import('@/components/rfp/EnhancedRFPMonitoringDashboard'), {
  ssr: false
});
const RFPIntelligenceEntityBrowser = dynamicImport(() => import('./entity-browser'), {
  ssr: false
});
const RFPDetectionsList = dynamicImport(() => import('./rfp-detections-list'), {
  ssr: false
});

export default function RFPIntelligencePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isContentTransitioning, setIsContentTransitioning] = useState(false);
  const previousTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['dashboard', 'detections', 'entities', 'analysis', 'search'].includes(tab)) {
      setActiveTab(tab);
    }

    const handlePopState = () => {
      const nextParams = new URLSearchParams(window.location.search);
      const nextTab = nextParams.get('tab');
      if (nextTab && ['dashboard', 'detections', 'entities', 'analysis', 'search'].includes(nextTab)) {
        setActiveTab(nextTab);
        return;
      }
      setActiveTab('dashboard');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  useEffect(() => {
    if (previousTabRef.current === null) {
      previousTabRef.current = activeTab;
      return;
    }
    if (previousTabRef.current !== activeTab) {
      setIsContentTransitioning(true);
      const timeout = setTimeout(() => setIsContentTransitioning(false), 200);
      previousTabRef.current = activeTab;
      return () => clearTimeout(timeout);
    }
  }, [activeTab]);

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen" style={{ background: '#242834' }}>
      {/* Tab Navigation */}
      <div className="bg-custom-box border-b border-custom-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'dashboard', label: 'RFP Dashboard', icon: Trophy },
              { id: 'detections', label: 'RFP Detections', icon: List },
              { id: 'entities', label: 'Entity Browser', icon: Database },
              { id: 'analysis', label: 'RFP Analysis', icon: Brain },
              { id: 'search', label: 'Search', icon: Search }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-body-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-fm-yellow text-fm-yellow bg-custom-bg'
                    : 'border-transparent text-fm-medium-grey hover:text-fm-white hover:border-fm-medium-grey'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div
        className={`transition-opacity duration-200 ${isContentTransitioning ? 'opacity-0' : 'opacity-100'}`}
        style={{ viewTransitionName: "dossier-content" }}
      >
        {activeTab === 'dashboard' && (
          <EnhancedRFPMonitoringDashboard
            title={false}
            subtitle={false}
            showAnalytics={true}
            showSystemMetrics={true}
          />
        )}

        {activeTab === 'detections' && (
          <RFPDetectionsList />
        )}

        {activeTab === 'entities' && (
          <RFPIntelligenceEntityBrowser />
        )}

        {activeTab === 'analysis' && (
          <div className="container mx-auto px-4 py-8">
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-8 text-center">
              <Brain className="w-16 h-16 text-fm-yellow mx-auto mb-4" />
              <h2 className="font-header-large text-fm-white mb-4">RFP Analysis Tools</h2>
              <p className="font-body-primary text-fm-medium-grey mb-6">
                Advanced AI-powered RFP analysis tools are coming soon. This section will include comprehensive 
                market analysis, competitive intelligence, and opportunity scoring.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
                  <Brain className="w-8 h-8 text-fm-yellow mb-3" />
                  <h3 className="font-subheader text-fm-white mb-2">AI Analysis</h3>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Advanced AI-powered RFP analysis with confidence scoring
                  </p>
                </div>
                <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
                  <Trophy className="w-8 h-8 text-fm-green mb-3" />
                  <h3 className="font-subheader text-fm-white mb-2">Opportunity Scoring</h3>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Intelligent scoring based on fit, value, and win probability
                  </p>
                </div>
                <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
                  <Database className="w-8 h-8 text-fm-blue mb-3" />
                  <h3 className="font-subheader text-fm-white mb-2">Market Intelligence</h3>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Comprehensive market analysis and trend identification
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="container mx-auto px-4 py-8">
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-8 text-center">
              <Search className="w-16 h-16 text-fm-yellow mx-auto mb-4" />
              <h2 className="font-header-large text-fm-white mb-4">Advanced RFP Search</h2>
              <p className="font-body-primary text-fm-medium-grey mb-6">
                Powerful search capabilities for RFP opportunities are coming soon. This section will include 
                advanced filtering, semantic search, and intelligent matching.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
                  <Search className="w-8 h-8 text-fm-yellow mb-3" />
                  <h3 className="font-subheader text-fm-white mb-2">Smart Search</h3>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    AI-powered semantic search across all RFP data
                  </p>
                </div>
                <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
                  <Database className="w-8 h-8 text-fm-blue mb-3" />
                  <h3 className="font-subheader text-fm-white mb-2">Intelligent Filtering</h3>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Advanced filtering with multi-dimensional criteria
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
