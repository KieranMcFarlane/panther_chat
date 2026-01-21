/**
 * GLM-4.5V Vision Analyzer Component
 * 
 * Frontend component for visual RFP analysis and document processing
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, 
  Eye, 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  FileText,
  Globe,
  Trophy,
  Building
} from 'lucide-react';

interface AnalysisResult {
  success: boolean;
  results?: any;
  processed_at?: string;
  error?: string;
}

export function GLM4VAnalyzer() {
  const [documentUrl, setDocumentUrl] = useState('');
  const [analysisType, setAnalysisType] = useState('requirements');
  const [context, setContext] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'document' | 'webpage' | 'validation'>('document');

  const analyzeDocument = useCallback(async () => {
    if (!documentUrl) return;

    setIsAnalyzing(true);
    setResults(null);

    try {
      const response = await fetch('/api/rfp-vision-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze_rfp_document',
          documentUrl,
          analysisType,
          context
        }),
      });

      const result = await response.json();
      setResults(result);
    } catch (error) {
      setResults({
        success: false,
        error: 'Analysis failed. Please try again.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [documentUrl, analysisType, context]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Convert file to base64 for analysis
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setDocumentUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderResults = () => {
    if (!results) return null;

    if (!results.success) {
      return (
        <Card className="mt-6 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Analysis Failed</span>
            </div>
            <p className="text-sm text-red-600 mt-2">{results.error}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mt-6 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Analysis Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processed:</span>
              <span>{new Date(results.processed_at || '').toLocaleString()}</span>
            </div>
            
            {results.results && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Analysis Results:</h4>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(results.results, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Brain className="w-8 h-8 text-blue-600" />
          GLM-4.5V Vision Analysis
        </h1>
        <p className="text-muted-foreground">
          Advanced visual reasoning for RFP documents and business intelligence
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <Button
          variant={activeTab === 'document' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('document')}
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          RFP Documents
        </Button>
        <Button
          variant={activeTab === 'webpage' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('webpage')}
          className="flex items-center gap-2"
        >
          <Globe className="w-4 h-4" />
          Web Intelligence
        </Button>
        <Button
          variant={activeTab === 'validation' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('validation')}
          className="flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Authenticity Check
        </Button>
      </div>

      {/* Document Analysis Tab */}
      {activeTab === 'document' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              RFP Document Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Document URL or Upload</label>
              <div className="space-y-2">
                <Input
                  placeholder="Enter document URL or upload file..."
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </Button>
                  {documentUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(documentUrl, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Analysis Type</label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requirements">Requirements Extraction</SelectItem>
                  <SelectItem value="compliance">Compliance Check</SelectItem>
                  <SelectItem value="scoring">Fit Score Analysis</SelectItem>
                  <SelectItem value="deadlines">Deadline Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Context (Optional)</label>
              <Textarea
                placeholder="Additional context for analysis..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={analyzeDocument}
              disabled={!documentUrl || isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Web Intelligence Tab */}
      {activeTab === 'webpage' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Web Intelligence Extraction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Organization Type</label>
                <Select defaultValue="club">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">Sports Club</SelectItem>
                    <SelectItem value="league">Sports League</SelectItem>
                    <SelectItem value="federation">Sports Federation</SelectItem>
                    <SelectItem value="venue">Stadium/Venue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Focus Area</label>
                <Select defaultValue="partnerships">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partnerships">Partnerships</SelectItem>
                    <SelectItem value="digital_transformation">Digital Transformation</SelectItem>
                    <SelectItem value="procurement_signals">Procurement Signals</SelectItem>
                    <SelectItem value="technology_stack">Technology Stack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Website Screenshots</label>
              <Input
                placeholder="Enter screenshot URLs (comma-separated)..."
                className="mb-2"
              />
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Screenshots
              </Button>
            </div>

            <Button className="w-full">
              <Trophy className="w-4 h-4 mr-2" />
              Extract Intelligence
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Authenticity Check Tab */}
      {activeTab === 'validation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              RFP Authenticity Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Validate RFP Authenticity</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Use AI-powered visual analysis to verify if RFP opportunities are legitimate or fabricated.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Organization Name</label>
              <Input placeholder="Enter organization name..." />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Organization Website</label>
              <Input placeholder="https://example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">RFP Screenshots</label>
              <Input
                placeholder="Upload RFP page screenshots for validation..."
                className="mb-2"
              />
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Screenshots
              </Button>
            </div>

            <Button className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Validate Authenticity
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {renderResults()}

      {/* Feature Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <Brain className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-medium">Visual Reasoning</h3>
            <p className="text-sm text-muted-foreground">Advanced AI analysis of documents and images</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-medium">Authenticity Check</h3>
            <p className="text-sm text-muted-foreground">Verify RFP legitimacy with AI validation</p>
          </CardContent>
        </Card>
        
        <Card className="border-purple-200">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-medium">Business Intelligence</h3>
            <p className="text-sm text-muted-foreground">Extract strategic insights from visual data</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}