'use client';

import { useState } from 'react';
import { Search, Loader2, Sparkles, Target, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VectorSearch from '@/components/ui/VectorSearch';

interface SearchResult {
  id: string;
  entity_id?: string;
  name: string;
  type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'contact' | 'unknown';
  score: number;
  metadata?: Record<string, any>;
}

export default function VectorSearchTestPage() {
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performManualSearch = async (query: string) => {
    if (!query.trim()) {
      setManualResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10, score_threshold: 0.1 }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setManualResults(data.results || []);
    } catch (err) {
      setError('Search failed. Please try again.');
      setManualResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'club': return 'bg-blue-500';
      case 'sportsperson': return 'bg-green-500';
      case 'tender': return 'bg-yellow-500';
      case 'poi': return 'bg-purple-500';
      case 'contact': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'club': return '🏟️';
      case 'sportsperson': return '⚽';
      case 'tender': return '📋';
      case 'poi': return '👤';
      case 'contact': return '📞';
      default: return '🔍';
    }
  };

  const testQueries = [
    'football club in London',
    'Arsenal captain',
    'sports agent',
    'digital transformation',
    'Premier League',
    'Norwegian midfielder',
    'sports technology',
    'London-based football'
  ];

  return (
    <div className="min-h-screen bg-custom-bg text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-full">
              <Sparkles className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-4xl font-bold">Vector Search Testing</h1>
          </div>
          <p className="text-fm-light-grey text-lg">
            Test your AI-powered semantic search with Supabase + OpenAI
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Database className="w-5 h-5 text-blue-400" />
                Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">Supabase</div>
              <p className="text-fm-medium-grey text-sm">pgvector + 5 demo entities</p>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="w-5 h-5 text-yellow-400" />
                Embeddings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">OpenAI</div>
              <p className="text-fm-medium-grey text-sm">text-embedding-3-small</p>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-green-400" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">Active</div>
              <p className="text-fm-medium-grey text-sm">Ready for testing</p>
            </CardContent>
          </Card>
        </div>

        {/* Integrated Vector Search Component */}
        <Card className="bg-custom-box border-custom-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Search className="w-5 h-5" />
              Integrated Vector Search Component
            </CardTitle>
            <CardDescription className="text-fm-medium-grey">
              This is the actual VectorSearch component integrated into your navigation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-6">
              <VectorSearch />
            </div>
          </CardContent>
        </Card>

        {/* Manual Search Testing */}
        <Card className="bg-custom-box border-custom-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Target className="w-5 h-5" />
              Manual Search Testing
            </CardTitle>
            <CardDescription className="text-fm-medium-grey">
              Test the API directly with custom queries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Input */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fm-medium-grey w-4 h-4" />
                <Input
                  placeholder="Try: football club in London, Arsenal captain, etc."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performManualSearch(manualQuery)}
                  className="bg-custom-bg border-custom-border text-white pl-10"
                />
              </div>
              <Button 
                onClick={() => performManualSearch(manualQuery)}
                disabled={loading || !manualQuery.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
            </div>

            {/* Quick Test Queries */}
            <div>
              <p className="text-sm text-fm-medium-grey mb-3">Quick test queries:</p>
              <div className="flex flex-wrap gap-2">
                {testQueries.map((query, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualQuery(query);
                      performManualSearch(query);
                    }}
                    className="border-custom-border text-fm-medium-grey hover:bg-custom-border hover:text-white"
                  >
                    {query}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {manualResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Search Results ({manualResults.length})
                </h3>
                <div className="space-y-3">
                  {manualResults.map((result, index) => (
                    <div key={result.id} className="flex items-center gap-4 p-4 bg-custom-bg border border-custom-border rounded-md hover:bg-custom-border/50 transition-colors">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">{getTypeIcon(result.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-white truncate">{result.name}</span>
                          <Badge variant="secondary" className={`${getTypeColor(result.type)} text-white text-xs`}>
                            {result.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-green-400 border-green-400">
                            {(result.score * 100).toFixed(1)}% match
                          </Badge>
                        </div>
                        {result.metadata && (
                          <div className="text-xs text-fm-medium-grey space-x-2">
                            {Object.entries(result.metadata).slice(0, 3).map(([key, value]) => (
                              <span key={key}>{key}: {String(value)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-lg font-bold text-yellow-400">
                          {(result.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && manualQuery && manualResults.length === 0 && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto mb-4 text-fm-medium-grey opacity-50" />
                <p className="text-fm-medium-grey">No results found for "{manualQuery}"</p>
                <p className="text-fm-medium-grey text-sm mt-2">Try different keywords or check spelling</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Testing */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5" />
              API Testing
            </CardTitle>
            <CardDescription className="text-fm-medium-grey">
              Test the raw API endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black/30 p-4 rounded-md font-mono text-sm">
              <p className="text-fm-light-grey mb-2">curl -X POST http://localhost:3005/api/vector-search \</p>
              <p className="text-fm-light-grey mb-2">  -H "Content-Type: application/json" \</p>
              <p className="text-fm-light-grey">  -d '{JSON.stringify({query: "football club in London", limit: 5})}'</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}