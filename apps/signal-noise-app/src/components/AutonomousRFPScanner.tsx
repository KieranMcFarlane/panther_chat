'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, AlertCircle, Search } from 'lucide-react';

interface ScanResult {
  entities_processed: number;
  rfp_opportunities_found: number;
  scan_completed_at: string;
  workflow_status: string;
}

interface DiscoveredOpportunity {
  content_preview: string;
  urls_found: string[];
  rfp_indicators: number;
  timestamp: string;
}

export function AutonomousRFPScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [discoveredOpportunities, setDiscoveredOpportunities] = useState<DiscoveredOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startAutonomousScan = async () => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setDiscoveredOpportunities([]);

    try {
      const response = await fetch('/api/rfp-autonomous-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanType: 'comprehensive',
          entityLimit: 50
        })
      });

      const result = await response.json();

      if (result.success) {
        setScanResult(result.execution_summary);
        setDiscoveredOpportunities(result.discovered_opportunities || []);
      } else {
        setError(result.error || 'Scan failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white">🎯 Autonomous RFP Scanner</h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          One-button comprehensive RFP monitoring using verified patterns from Cricket West Indies, 
          Major League Cricket, and industry marketplace intelligence.
        </p>
      </div>

      {/* Main Scanner Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Search className="w-5 h-5" />
            RFP Intelligence Scanner
          </CardTitle>
          <CardDescription className="text-gray-300">
            Autonomous workflow: Entity Discovery → Pattern Search → Analysis → Results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Single Button */}
          <div className="flex justify-center">
            <Button
              onClick={startAutonomousScan}
              disabled={isScanning}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg font-semibold"
            >
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Scanning for RFP Opportunities...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Start Autonomous RFP Scan
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-semibold">Scan Failed</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Results Display */}
          {scanResult && (
            <div className="space-y-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="font-semibold text-green-400">Scan Completed Successfully</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{scanResult.entities_processed}</div>
                  <div className="text-sm text-gray-300">Entities Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{scanResult.rfp_opportunities_found}</div>
                  <div className="text-sm text-gray-300">RFP Opportunities Found</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-300">
                    {new Date(scanResult.scan_completed_at).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-gray-400">Completed At</div>
                </div>
              </div>
            </div>
          )}

          {/* Discovered Opportunities */}
          {discoveredOpportunities.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">🎯 Discovered Opportunities</h3>
              <div className="space-y-3">
                {discoveredOpportunities.map((opportunity, index) => (
                  <Card key={index} className="bg-gray-700/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                          {opportunity.rfp_indicators} RFP Indicators
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(opportunity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-3 line-clamp-3">
                        {opportunity.content_preview}
                      </p>
                      
                      {opportunity.urls_found.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-400">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {opportunity.urls_found.map((url, urlIndex) => (
                              <a
                                key={urlIndex}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/30 transition-colors"
                              >
                                {url.length > 40 ? `${url.substring(0, 40)}...` : url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verified Patterns Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">✅ Verified RFP Patterns</CardTitle>
          <CardDescription className="text-gray-300">
            Based on real, active RFPs from Cricket West Indies, Major League Cricket, and iSportConnect
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Badge variant="outline" className="text-green-400 border-green-400">
                Digital Transformation
              </Badge>
              <p className="text-sm text-gray-300">
                "invites proposals from digital transformation agencies to spearhead comprehensive initiatives"
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="text-green-400 border-green-400">
                Ticketing Systems
              </Badge>
              <p className="text-sm text-gray-300">
                "soliciting proposals from ticketing service providers to implement fully integrated systems"
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="text-green-400 border-green-400">
                Mobile App Development
              </Badge>
              <p className="text-sm text-gray-300">
                "request for proposals for mobile application development and fan engagement platforms"
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="text-green-400 border-green-400">
                Web Platform Redesign
              </Badge>
              <p className="text-sm text-gray-300">
                "invitation to tender for website redesign and digital platform modernization"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}