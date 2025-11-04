'use client';

import { useState } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SimpleVectorSearchTestPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 }),
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold">Vector Search Test</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Test your AI-powered semantic search
          </p>
        </div>

        {/* Search Card */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Search Entities</CardTitle>
            <CardDescription className="text-gray-400">
              Try searching for sports entities, people, or opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="e.g., football club in London, Arsenal captain"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Button 
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>
            </div>

            {/* Quick Test Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                'football club in London',
                'Arsenal captain', 
                'sports agent',
                'digital transformation'
              ].map((testQuery, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery(testQuery);
                    handleSearch();
                  }}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  {testQuery}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {error && (
          <Card className="bg-red-900/20 border-red-700 mb-6">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Results ({results.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result: any, index) => (
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
            </CardContent>
          </Card>
        )}

        {!loading && !error && query && results.length === 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No results found for "{query}"</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}