/**
 * Discovery Analytics Dashboard Component
 * Shows analytics for the retroactive RFP discovery system
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Play,
  Pause,
  RefreshCw,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface DiscoveryAnalytics {
  totalEntities: number;
  estimatedDiscoveries: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  processingTime: string;
  valueBreakdown: {
    highValueEntities: number;
    mediumValueEntities: number;
    lowValueEntities: number;
  };
}

interface Props {
  onStartDiscovery?: () => void;
  onStopDiscovery?: () => void;
  isProcessing?: boolean;
  className?: string;
}

export default function DiscoveryAnalyticsDashboard({ 
  onStartDiscovery, 
  onStopDiscovery, 
  isProcessing = false,
  className = "" 
}: Props) {
  const [analytics, setAnalytics] = useState<DiscoveryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/retroactive-discovery?action=get-potential');
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.potential);
      }
    } catch (error) {
      console.error('Failed to fetch discovery analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading discovery analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            Failed to load discovery analytics
          </div>
        </CardContent>
      </Card>
    );
  }

  const hitRate = (analytics.estimatedDiscoveries.total / analytics.totalEntities * 100);
  const businessValue = analytics.estimatedDiscoveries.high * 500000 + 
                        analytics.estimatedDiscoveries.medium * 100000;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Discovery Analytics Dashboard
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchAnalytics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              {isProcessing ? (
                <Button size="sm" variant="destructive" onClick={onStopDiscovery}>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Discovery
                </Button>
              ) : (
                <Button size="sm" onClick={onStartDiscovery}>
                  <Play className="w-4 h-4 mr-2" />
                  Start Discovery
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {analytics.totalEntities.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Entities</div>
              <div className="text-xs text-muted-foreground mt-1">In Knowledge Graph</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {analytics.estimatedDiscoveries.total}
              </div>
              <div className="text-sm text-muted-foreground">Expected RFPs</div>
              <div className="text-xs mt-1">
                {hitRate.toFixed(1)}% hit rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {analytics.processingTime}
              </div>
              <div className="text-sm text-muted-foreground">Processing Time</div>
              <div className="text-xs text-muted-foreground mt-1">Estimated</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                £{(businessValue / 1000000).toFixed(1)}M
              </div>
              <div className="text-sm text-muted-foreground">Business Value</div>
              <div className="text-xs text-muted-foreground mt-1">Estimated</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Discovery Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {analytics.estimatedDiscoveries.high}
              </div>
              <div className="text-sm text-muted-foreground">High Value Opportunities</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.valueBreakdown.highValueEntities} entities
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {analytics.estimatedDiscoveries.medium}
              </div>
              <div className="text-sm text-muted-foreground">Medium Value Opportunities</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.valueBreakdown.mediumValueEntities} entities
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {analytics.estimatedDiscoveries.low}
              </div>
              <div className="text-sm text-muted-foreground">Low Value Opportunities</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.valueBreakdown.lowValueEntities} entities
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Summary */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">
                  Ready to process {analytics.totalEntities.toLocaleString()} entities
                </div>
                <div className="text-sm text-muted-foreground">
                  Estimated {analytics.estimatedDiscoveries.total} RFP discoveries
                </div>
              </div>
            </div>
            <Button 
              onClick={onStartDiscovery}
              disabled={isProcessing}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Start Discovery
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}