'use client';

import { useState } from 'react';
import { Search, Loader2, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VectorSearchDebounced from '@/components/ui/VectorSearch-debounced';

export default function DebounceTestPage() {
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchCount, setSearchCount] = useState(0);

  const performManualSearch = async (query: string) => {
    if (!query.trim()) {
      setManualResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setSearchCount(prev => prev + 1);

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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold">Debounced Search Test</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Compare instant search vs. debounced search
          </p>
        </div>

        {/* Debounce Info */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Zap className="w-5 h-5 text-yellow-400" />
              Debouncing Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-400 mb-2">✅ Debounced Search (Recommended)</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Waits 500ms after you stop typing before searching
                </p>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Fewer API calls (cost-efficient)</li>
                  <li>• Better user experience</li>
                  <li>• Reduces server load</li>
                  <li>• Shows loading indicator</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-orange-400 mb-2">⚡ Instant Search</h4>
                <p className="text-gray-300 text-sm mb-3">
                  Searches on every keystroke change
                </p>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Immediate results</li>
                  <li>• Higher API usage</li>
                  <li>• Potential rate limiting</li>
                  <li>• Can feel "jumpy"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test 1: Debounced Component */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-green-400">🐌 Debounced VectorSearch Component</CardTitle>
            <CardDescription className="text-gray-400">
              This is the shadcn/ui component with proper debouncing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-6">
              <VectorSearchDebounced />
            </div>
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-300">
                <strong>Test it:</strong> Type "football" then wait 500ms before typing "club"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test 2: Instant Search */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-orange-400">⚡ Instant Search (For Comparison)</CardTitle>
            <CardDescription className="text-gray-400">
              Manual search without debouncing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Type here for instant search..."
                  value={manualQuery}
                  onChange={(e) => {
                    setManualQuery(e.target.value);
                    performManualSearch(e.target.value);
                  }}
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                />
              </div>
              <Badge variant="outline" className="border-orange-400 text-orange-400">
                Instant (No Delay)
              </Badge>
              {searchCount > 0 && (
                <Badge variant="outline" className="border-gray-400 text-gray-400">
                  Searches: {searchCount}
                </Badge>
              )}
            </div>

            {/* Results */}
            {error && (
              <div className="p-4 bg-red-900/20 border-red-700 rounded-md">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {manualResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Results ({manualResults.length})</h3>
                <div className="space-y-3">
                  {manualResults.map((result: any, index) => (
                    <div key={result.id} className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-white">{result.name}</span>
                          <Badge className="bg-blue-600">{result.type}</Badge>
                          <Badge variant="outline" className="border-green-400 text-green-400">
                            {Math.round(result.score * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Entity ID: {result.entity_id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && manualQuery && manualResults.length === 0 && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400">No results found for "{manualQuery}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Comparison */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">📊 Performance Comparison</CardTitle>
            <CardDescription className="text-gray-400">
              Why debouncing matters for vector search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">~80%</div>
                <p className="text-gray-300 text-sm">API Cost Reduction</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">500ms</div>
                <p className="text-gray-300 text-sm">Debounce Delay</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">2s</div>
                <p className="text-gray-300 text-sm">Max Wait Time</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-300">
                <strong>💡 Tip:</strong> Vector search calls OpenAI API, so debouncing prevents unnecessary API calls and reduces costs while maintaining good UX.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}